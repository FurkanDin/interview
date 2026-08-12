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

        $this->router->get('/api/order-status/(\d+)', function ($orderNo) {
            header('Content-Type: application/json');
            $client = new \Turkpin\InterviewTest\TurkpinApiClient();
            try {
                $response = $client->getOrderStatus($orderNo);
                $params = $response['params'] ?? [];
                
                $durumKodu = $params['DURUM_KODU'] ?? null;
                $siparisDurumu = $params['SIPARIS_DURUMU'] ?? null;
                $aciklama = $params['SIPARIS_DURUMU_ACIKLAMA'] ?? 'Sipariş durumu sorgulandı.';
                $ekstra = $params['EKSTRA'] ?? ($params['EXTRA'] ?? '');

                echo json_encode([
                    'success' => true,
                    'durum_kodu' => $durumKodu,
                    'siparis_durumu' => $siparisDurumu,
                    'aciklama' => $aciklama,
                    'ekstra' => $ekstra,
                    'raw' => $params
                ]);
            } catch (\Exception $e) {
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
            exit;
        });
        $this->router->get('/api/order-list', function () {
            header('Content-Type: application/json');
            $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-7 days'));
            $endDate = $_GET['end_date'] ?? date('Y-m-d');

            // Date validation (max 30 days)
            $diffDays = (strtotime($endDate) - strtotime($startDate)) / 86400;
            if ($diffDays < 0) {
                echo json_encode(['success' => false, 'message' => 'Başlangıç tarihi bitiş tarihinden büyük olamaz. (Hata 30)']);
                exit;
            }
            if ($diffDays > 30) {
                echo json_encode(['success' => false, 'message' => 'Tarih aralığı en fazla 30 gün olabilir. (Hata 31)']);
                exit;
            }

            $client = new \Turkpin\InterviewTest\TurkpinApiClient();
            try {
                $response = $client->getOrderList($startDate, $endDate);
                
                $hataNo = $response['params']['HATA_NO'] ?? null;
                if ($hataNo && $hataNo !== '000') {
                    echo json_encode([
                        'success' => false,
                        'error_code' => $hataNo,
                        'message' => $response['params']['HATA_ACIKLAMA'] ?? 'Sipariş listesi alınamadı.'
                    ]);
                    exit;
                }

                $orders = [];
                if (isset($response['params']['SIPARISLER']['SIPARIS'])) {
                    $siparisData = $response['params']['SIPARISLER']['SIPARIS'];
                    $orders = isset($siparisData['SIPARIS_NO']) ? [$siparisData] : $siparisData;
                }

                echo json_encode([
                    'success' => true,
                    'data' => $orders,
                    'start_date' => $startDate,
                    'end_date' => $endDate
                ]);
            } catch (\Exception $e) {
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
            exit;
        });

        $this->router->get('/api/balance', function () {
            header('Content-Type: application/json');
            $client = new \Turkpin\InterviewTest\TurkpinApiClient();
            try {
                $response = $client->getBalance();
                $params = $response['params'] ?? [];
                
                $bakiye = $params['bakiye'] ?? ($params['balance'] ?? null);
                $errorCode = $params['HATA_NO'] ?? null;

                if ($errorCode && $errorCode !== '000') {
                    echo json_encode(['success' => false, 'message' => $params['HATA_ACIKLAMA'] ?? 'Bakiye sorgulanamadı.']);
                } else {
                    echo json_encode(['success' => true, 'balance' => $bakiye, 'data' => $params]);
                }
            } catch (\Exception $e) {
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
            exit;
        });

        $this->router->post('/api/order', function () {
            header('Content-Type: application/json');

            $productId = $_POST['product_id'] ?? null;
            $quantity = $_POST['quantity'] ?? 1;
            $gameId = $_POST['game_id'] ?? null;

            $extraParams = [];
            if (!empty($_POST['pre_order'])) {
                $extraParams['pre_order'] = $_POST['pre_order'];
            }
            if (!empty($_POST['character'])) {
                $extraParams['character'] = $_POST['character'];
            }
            if (!empty($_POST['barem'])) {
                $extraParams['barem'] = $_POST['barem'];
            }

            if (!$productId || $quantity < 1) {
                echo json_encode(['success' => false, 'message' => 'Geçersiz ürün veya miktar.']);
                exit;
            }

            // Per-product double submit protection (1 second)
            $orderKey = 'last_order_' . $productId;
            if (isset($_SESSION[$orderKey]) && (time() - $_SESSION[$orderKey] < 1)) {
                echo json_encode(['success' => false, 'message' => 'Lütfen işleminizin tamamlanmasını bekleyin.']);
                exit;
            }
            $_SESSION[$orderKey] = time();

            $client = new \Turkpin\InterviewTest\TurkpinApiClient();
            try {
                $response = $client->createOrder($productId, $quantity, $gameId, $extraParams);
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
