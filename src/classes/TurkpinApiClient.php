<?php

namespace Turkpin\InterviewTest;

class TurkpinApiClient
{
    private $apiUrl;
    private $username;
    private $password;

    public function __construct()
    {
        $this->apiUrl = $_ENV['API_URL'] ?? 'https://www.turkpin.net/api.php';
        $this->username = $_ENV['API_USERNAME'] ?? 'api@turkpin.net';
        $this->password = $_ENV['API_PASSWORD'] ?? '@.nwjExrK4U5b_S@y';
    }

    private function request($cmd, $params = [])
    {
        $data = array_merge([
            'username' => $this->username,
            'password' => $this->password,
            'cmd' => $cmd
        ], $params);

        // Convert data array to XML
        $xmlData = '<APIRequest><params>';
        foreach ($data as $key => $value) {
            $xmlData .= "<{$key}>" . htmlspecialchars($value) . "</{$key}>";
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
            throw new \Exception("API Connection Error: " . $error);
        }

        // Basit XML parse (Turkpin genelde XML kullanır)
        if (strpos($response, '<?xml') !== false) {
            $xml = simplexml_load_string($response);
            return json_decode(json_encode($xml), true);
        }

        $decoded = json_decode($response, true);
        return $decoded ?: $response;
    }

    public function getGames()
    {
        return $this->request('epinOyunListesi');
    }

    public function getProducts($gameId)
    {
        return $this->request('epinUrunleri', ['oyunKodu' => $gameId]);
    }

    public function createOrder($productId, $quantity, $gameId = null)
    {
        $params = [
            'urunKodu' => $productId,
            'sipadet' => $quantity
        ];
        
        if ($gameId) {
            $params['oyunKodu'] = $gameId;
        }
        
        return $this->request('epinSiparisYarat', $params);
    }
}
