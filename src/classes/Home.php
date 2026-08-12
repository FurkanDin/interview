<?php

class Home
{
    public function __construct(
        private readonly \Smarty\Smarty $view,
        private readonly array $language
    ) {
    }

    public function index()
    {
        $games = [];
        $products = []; 

        try {
            $client = new \Turkpin\InterviewTest\TurkpinApiClient();
            $response = $client->getGames();
            
            if (isset($response['params']['oyunListesi']['oyun'])) {
                $gameData = $response['params']['oyunListesi']['oyun'];
                if (isset($gameData['id'])) {
                    $games[$gameData['id']] = $gameData['name'];
                } else {
                    foreach ($gameData as $game) {
                        if (isset($game['id'])) $games[$game['id']] = $game['name'];
                    }
                }
            } else if (isset($response['data']) && is_array($response['data'])) {
                foreach ($response['data'] as $game) {
                    $games[$game['id']] = $game['name'];
                }
            } else if (is_array($response)) {
                foreach ($response as $item) {
                    if (isset($item['id']) && isset($item['name'])) {
                        $games[$item['id']] = $item['name'];
                    }
                }
            }
            
            if (empty($games)) {
                $this->view->assign('error', $this->language['game_list_empty']);
            }
        } catch (\Exception $e) {
            error_log('Game list request failed: ' . $e->getMessage());
            $this->view->assign('error', $this->language['game_list_error']);
        }

        $this->view->assign('games', $games);
        $this->view->assign('products', $products);

        $this->view->assign('template', 'home.html');
    }
}
