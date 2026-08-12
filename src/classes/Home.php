<?php

class Home
{
    public function index()
    {
        global $smarty;

        $games = [];
        $products = []; // Will be loaded via AJAX

        try {
            $client = new \Turkpin\InterviewTest\TurkpinApiClient();
            $response = $client->getGames();
            
            // Assume response is array of games or has a 'data' key
            if (isset($response['data']) && is_array($response['data'])) {
                foreach ($response['data'] as $game) {
                    $games[$game['id']] = $game['name'];
                }
            } else if (is_array($response)) {
                // Mock mapping if API structure is direct array
                foreach ($response as $item) {
                    if (isset($item['id']) && isset($item['name'])) {
                        $games[$item['id']] = $item['name'];
                    }
                }
            }
            
            if (empty($games)) {
                $smarty->assign('error', 'Oyun listesi boş döndü veya yapı okunamadı. Ham Yanıt: ' . print_r($response, true));
            }
        } catch (\Exception $e) {
            $smarty->assign('error', 'Oyun listesi alınırken bir hata oluştu: ' . $e->getMessage());
        }

        $smarty->assign('games', $games);
        $smarty->assign('products', $products);

        $smarty->assign('template', 'home.html');
    }
}
