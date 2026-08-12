<?php

namespace Turkpin\InterviewTest;

class TurkpinApiClient
{
    private string $apiUrl;
    private string $username;
    private string $password;

    public function __construct()
    {
        $this->apiUrl = $_ENV['API_URL'] ?? 'https://www.turkpin.net/api.php';
        $this->username = (string) ($_ENV['API_USERNAME'] ?? '');
        $this->password = (string) ($_ENV['API_PASSWORD'] ?? '');

        if ($this->username === '' || $this->password === '') {
            throw new \RuntimeException('Turkpin API credentials are not configured.');
        }
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
        curl_setopt($ch, CURLOPT_URL, $this->apiUrl);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query(['DATA' => $xmlData]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        // Timeout ayarı
        curl_setopt($ch, CURLOPT_TIMEOUT, 15); 
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new \RuntimeException('API connection failed: ' . $error);
        }

        // Basit XML parse (Turkpin genelde XML kullanır)
        if (strpos($response, '<?xml') !== false) {
            $xml = simplexml_load_string($response, 'SimpleXMLElement', LIBXML_NONET);
            if ($xml === false) {
                throw new \RuntimeException('Invalid XML response received from API.');
            }
            return json_decode(json_encode($xml), true);
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('Invalid response received from API.');
        }

        return $decoded;
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
