<?php
// Load .env from project root (optional): DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
$configDir = __DIR__;
$projectRoot = dirname($configDir, 3);
$envFile = $projectRoot . DIRECTORY_SEPARATOR . '.env';
if (is_file($envFile) && is_readable($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (strpos($line, '=') !== false) {
            $key = trim(substr($line, 0, strpos($line, '=')));
            $val = trim(substr($line, strpos($line, '=') + 1));
            $val = trim($val, '"\'');
            if (!array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $val;
                putenv("$key=$val");
            }
        }
    }
}

//define site url
// Use localhost for local development
if (!defined('BURL')) {
    // Detect base URL from server or use default
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
    $baseUrl = $protocol . '://' . $host . '/';
    define('BURL', $baseUrl);
}

/****************************************************\
 * -               database  configuration              -
 * \****************************************************/
// Use 127.0.0.1 + port to force TCP (avoids "No such file or directory" on macOS when MySQL socket path differs)
// Values from .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) override these defaults.
if (!defined('HOST')) {
    define('HOST', getenv('DB_HOST') !== false ? getenv('DB_HOST') : "127.0.0.1");
    define('PORT', (int)(getenv('DB_PORT') !== false ? getenv('DB_PORT') : 3306));
    define('USER', getenv('DB_USER') !== false ? getenv('DB_USER') : "root");
    define('PASS', getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : "Spd7890&*()");
    define('DBNAME', getenv('DB_NAME') !== false ? getenv('DB_NAME') : "shipcruisetour");
}


