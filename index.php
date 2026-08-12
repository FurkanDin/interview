<?php
session_start();
require_once __DIR__ . '/vendor/autoload.php';

if (file_exists(__DIR__ . '/.env')) {
    Dotenv\Dotenv::createImmutable(__DIR__)->safeLoad();
}

$application = new \Turkpin\InterviewTest\Application(__DIR__);
$application->run();
