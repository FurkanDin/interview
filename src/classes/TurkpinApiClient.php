<?php

namespace Turkpin\InterviewTest;

class TurkpinApiClient
{
    private string $apiUrl;
    private string $username;
    private string $password;

    public function __construct()
    {
        $this->apiUrl = $this->getEnvironmentVariable(
            'API_URL',
            'https://www.turkpin.net/api.php'
        );
        $this->username = $this->getEnvironmentVariable('API_USERNAME');
        $this->password = $this->getEnvironmentVariable('API_PASSWORD');

        if ($this->username === '' || $this->password === '') {
            throw new \RuntimeException('Turkpin API credentials are not configured.');
        }
    }

    private function getEnvironmentVariable(string $key, string $default = ''): string
    {
        $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);

        if ($value === false || $value === null || $value === '') {
            return $default;
        }

        return (string) $value;
    }

    private function request(string $cmd, array $params = []): array
    {
        $data = array_merge([
            'username' => $this->username,
            'password' => $this->password,
            'cmd' => $cmd
        ], $params);

        // Convert data array to XML
        $xmlData = '<APIRequest><params>';
        foreach ($data as $key => $value) {
            $xmlData .= "<{$key}>" . htmlspecialchars((string)($value ?? ''), ENT_XML1 | ENT_QUOTES, 'UTF-8') . "</{$key}>";
        }
        $xmlData .= '</params></APIRequest>';

        $ch = curl_init();
        if ($ch === false) {
            throw new \RuntimeException('Unable to initialize the API connection.');
        }

        curl_setopt($ch, CURLOPT_URL, $this->apiUrl);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query(['DATA' => $xmlData]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        // Timeout ayarı
        curl_setopt($ch, CURLOPT_TIMEOUT, 15); 
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        $httpStatus = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $contentType = (string) (curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'unknown');
        curl_close($ch);

        if ($response === false) {
            throw new \RuntimeException('API connection failed: ' . $error);
        }

        $responseBody = trim($response);
        if ($responseBody === '') {
            throw new \RuntimeException($this->createInvalidResponseMessage(
                $cmd,
                $httpStatus,
                $contentType,
                $responseBody
            ));
        }

        $decoded = json_decode($responseBody, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }

        if (str_starts_with($responseBody, '<')) {
            $previousErrorHandling = libxml_use_internal_errors(true);
            libxml_clear_errors();
            $xml = simplexml_load_string($responseBody, 'SimpleXMLElement', LIBXML_NONET);
            libxml_clear_errors();
            libxml_use_internal_errors($previousErrorHandling);

            if ($xml !== false && strtolower($xml->getName()) !== 'html') {
                $xmlData = json_decode(json_encode($xml), true);
                if (is_array($xmlData)) {
                    return $xmlData;
                }
            }
        }

        throw new \RuntimeException($this->createInvalidResponseMessage(
            $cmd,
            $httpStatus,
            $contentType,
            $responseBody
        ));
    }

    private function createInvalidResponseMessage(
        string $cmd,
        int $httpStatus,
        string $contentType,
        string $responseBody
    ): string {
        $message = sprintf(
            'Invalid API response for %s (HTTP %d, Content-Type: %s, Length: %d)',
            $cmd,
            $httpStatus,
            $contentType,
            strlen($responseBody)
        );

        if ($cmd !== 'epinOyunListesi' || $responseBody === '') {
            return $message;
        }

        $preview = strip_tags($responseBody);
        $preview = preg_replace('/\s+/', ' ', $preview) ?? '';
        $preview = trim(str_replace(
            [$this->username, $this->password],
            '[redacted]',
            $preview
        ));

        if ($preview !== '') {
            $message .= sprintf(', Preview: "%s"', substr($preview, 0, 200));
        }

        return $message;
    }

    public function getGames()
    {
        return $this->request('epinOyunListesi');
    }

    public function getProducts($gameId)
    {
        return $this->request('epinUrunleri', ['oyunKodu' => $gameId]);
    }

    public function createOrder($productId, $quantity, $gameId = null, $extraParams = [])
    {
        $params = array_merge([
            'oyunKodu' => $gameId,
            'urunKodu' => $productId,
            'adet' => $quantity
        ], is_array($extraParams) ? $extraParams : []);

        return $this->request('epinSiparisYarat', $params);
    }

    public function getOrderStatus($orderNo)
    {
        return $this->request('siparisDurumu', ['siparisNo' => $orderNo]);
    }

    public function getOrderList($startDate, $endDate)
    {
        return $this->request('siparisListesi', [
            'baslangicTarihi' => $startDate,
            'bitisTarihi' => $endDate
        ]);
    }

    public function getBalance()
    {
        return $this->request('balance');
    }
}
