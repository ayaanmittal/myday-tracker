<?php
// Ultimate PHP router for JavaScript MIME type issues
// This bypasses .htaccess completely

$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);

// Remove query string and fragments
$path = strtok($path, '?');
$path = strtok($path, '#');

// Get the file path
$file_path = __DIR__ . $path;

// Handle JavaScript files
if (preg_match('/\.(js|mjs)$/', $path)) {
    if (file_exists($file_path)) {
        // Set correct MIME type
        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: public, max-age=31536000');
        header('Access-Control-Allow-Origin: *');
        
        // Disable any caching that might interfere
        header('Pragma: public');
        header('Expires: ' . gmdate('D, d M Y H:i:s', time() + 31536000) . ' GMT');
        
        // Read and output the file
        readfile($file_path);
        exit;
    } else {
        http_response_code(404);
        echo 'JavaScript file not found: ' . $path;
        exit;
    }
}

// Handle CSS files
if (preg_match('/\.css$/', $path)) {
    if (file_exists($file_path)) {
        header('Content-Type: text/css; charset=utf-8');
        header('Cache-Control: public, max-age=31536000');
        readfile($file_path);
        exit;
    } else {
        http_response_code(404);
        echo 'CSS file not found: ' . $path;
        exit;
    }
}

// Handle other static files
if (file_exists($file_path) && is_file($file_path)) {
    // Let the server handle it normally
    return false;
}

// For all other requests, serve index.html
$index_file = __DIR__ . '/index.html';
if (file_exists($index_file)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($index_file);
} else {
    http_response_code(404);
    echo 'Index file not found';
}
?>
