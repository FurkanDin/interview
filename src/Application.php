<?php

namespace Turkpin\InterviewTest;

final class Application
{
    public function __construct(private readonly string $projectRoot)
    {
    }

    public function run(): void
    {
        $requestedLocale = $_GET['lang'] ?? $_SESSION['lang'] ?? 'tr';
        $locale = is_string($requestedLocale) && in_array($requestedLocale, ['tr', 'en'], true)
            ? $requestedLocale
            : 'tr';
        $language = require $this->projectRoot . '/src/languages/' . $locale . '.php';

        if (!is_array($language)) {
            throw new \RuntimeException('Invalid language catalogue.');
        }

        $_SESSION['lang'] = $locale;

        require_once $this->projectRoot . '/src/classes/Main.php';
        (new \Main($this->projectRoot, $language))->run();
    }
}
