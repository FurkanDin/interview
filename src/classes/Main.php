<?php

require_once __DIR__ . '/Home.php';
require_once __DIR__ . '/TurkpinApiClient.php';
class Main
{
    public $router;

    public function __construct()
    {
        global $lang, $smarty;

        $lang = $_SESSION['lang'] ?? 'tr';

        if (isset($_GET['lang'])) {
            $lang = $_GET['lang'];
            $_SESSION['lang'] = $lang;
        }

        require_once __DIR__ . "/../languages/{$lang}.php";

        $smarty = new Smarty\Smarty();
        $this->router = new \Bramus\Router\Router();

        $smarty->setTemplateDir('src/templates');
        $smarty->setCompileDir('/tmp');

        $smarty->assign('LANG', $lang);
        $smarty->assign('langs', ['tr' => 'Türkçe', 'en' => 'English']);
    }

    public function run()
    {
        global $smarty;

        $this->router->get('/', function () {
            $home = new Home();
            $home->index();
        });

        // API routes for frontend JS fetch calls
        $this->router->get('/api/products/(\d+)', function ($gameId) {
            header('Content-Type: application/json');
            $client = new \Turkpin\InterviewTest\TurkpinApiClient();
            try {
                $response = $client->getProducts($gameId);
                
                $products = [];
                if (isset($response['params']['epinUrunListesi']['urun'])) {
                    $urunData = $response['params']['epinUrunListesi']['urun'];
                    if (isset($urunData['id'])) {
                        $products = [$urunData];
                    } else {
                        $products = $urunData;
                    }
                } else if (isset($response['data'])) {
                    $products = $response['data'];
                }

                $errorCode = $response['params']['error'] ?? ($response['params']['HATA_NO'] ?? null);
                if ($errorCode && $errorCode !== '000') {
                    echo json_encode(['success' => false, 'message' => $response['params']['error_desc'] ?? ($response['params']['HATA_ACIKLAMA'] ?? 'API Hatası')]);
                } else {
                    echo json_encode(['success' => true, 'data' => $products]);
                }
            } catch (\Exception $e) {
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
            exit;
        });

        $this->router->post('/api/order', function () {
            header('Content-Type: application/json');
            
            // Basic idempotency check for double submit protection
            if (isset($_SESSION['last_order_time']) && (time() - $_SESSION['last_order_time'] < 5)) {
                echo json_encode(['success' => false, 'message' => 'Lütfen işleminizin tamamlanmasını bekleyin.']);
                exit;
            }
            $_SESSION['last_order_time'] = time();

            $productId = $_POST['product_id'] ?? null;
            $quantity = $_POST['quantity'] ?? 1;
            $gameId = $_POST['game_id'] ?? null;

            if (!$productId || $quantity < 1) {
                echo json_encode(['success' => false, 'message' => 'Geçersiz ürün veya miktar.']);
                exit;
            }

            $client = new \Turkpin\InterviewTest\TurkpinApiClient();
            try {
                $response = $client->createOrder($productId, $quantity, $gameId);
                $errorCode = $response['params']['HATA_NO'] ?? ($response['params']['error'] ?? ($response['code'] ?? null));
                
                if ($errorCode === '000') {
                    $msg = 'Sipariş başarıyla oluşturuldu.';
                    if (isset($response['params']['epin_list']['epin']['code'])) {
                        $msg .= ' E-Pin Kodu: ' . $response['params']['epin_list']['epin']['code'];
                    }
                    echo json_encode(['success' => true, 'message' => $msg]);
                } else {
                    $errorMsg = $response['params']['HATA_ACIKLAMA'] ?? ($response['params']['error_desc'] ?? ($response['message'] ?? 'Sipariş oluşturulamadı.'));
                    echo json_encode(['success' => false, 'message' => $errorMsg]);
                }
            } catch (\Exception $e) {
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
            exit;
        });

        $this->router->run();
        $smarty->display('index.html');
    }
}
