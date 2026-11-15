<?php

namespace App\Modules\Identity;

class DeviceKey
{
    public static function verify(string $encodedKey, string $message, string $encodedSignature): bool
    {
        if (strlen($encodedKey) > 512 || strlen($encodedSignature) > 256) {
            return false;
        }
        $der = base64_decode($encodedKey, true);
        $signature = base64_decode($encodedSignature, true);
        if ($der === false || $signature === false || base64_encode($der) !== $encodedKey) {
            return false;
        }
        $key = @openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n".chunk_split($encodedKey, 64, "\n")."-----END PUBLIC KEY-----\n");
        if ($key === false) {
            return false;
        }
        $details = openssl_pkey_get_details($key);
        if ($details === false || $details['type'] !== OPENSSL_KEYTYPE_EC || ($details['ec']['curve_name'] ?? '') !== 'prime256v1') {
            return false;
        }

        return @openssl_verify($message, $signature, $key, OPENSSL_ALGO_SHA256) === 1;
    }

    public static function activationMessage(string $token, string $publicKey): string
    {
        return "workforce-activation-v1\n".hash('sha256', $token)."\n".$publicKey;
    }

    public static function requestMessage(string $method, string $target, string $timestamp, string $nonce): string
    {
        return "workforce-device-v1\n".$method."\n".$target."\n".$timestamp."\n".$nonce;
    }
}
