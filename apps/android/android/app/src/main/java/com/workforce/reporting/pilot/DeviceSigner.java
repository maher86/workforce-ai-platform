package com.workforce.reporting.pilot;

import android.os.SystemClock;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONObject;

/** No key export, hardware IDs, biometrics or device-clock dependency. API23+, app min24. */
final class DeviceSigner {
    private final String origin;
    private final String alias;
    private long serverSeconds;
    private long sampledAt;
    DeviceSigner(String origin) throws Exception {
        this.origin = new URI(origin).getScheme() + "://" + new URI(origin).getAuthority();
        this.alias = "workforce.device." + hex(MessageDigest.getInstance("SHA-256").digest(this.origin.getBytes(StandardCharsets.UTF_8)));
    }
    static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        return result.toString();
    }
    synchronized private KeyStore store() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(alias)) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256).setUserAuthenticationRequired(false).build());
            generator.generateKeyPair();
            store.load(null);
        }
        return store;
    }
    synchronized String publicKey() throws Exception {
        return Base64.encodeToString(store().getCertificate(alias).getPublicKey().getEncoded(), Base64.NO_WRAP);
    }
    synchronized private String sign(String message) throws Exception {
        Signature signature = Signature.getInstance("SHA256withECDSA");
        signature.initSign((PrivateKey) store().getKey(alias, null));
        signature.update(message.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(signature.sign(), Base64.NO_WRAP);
    }
    synchronized Map<String, String> activation(String token) throws Exception {
        if (token == null || !token.matches("[A-Za-z0-9]{64}")) throw new IllegalArgumentException("Invalid activation");
        String publicKey = publicKey();
        String digest = hex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        Map<String, String> proof = new LinkedHashMap<>();
        proof.put("public_key", publicKey); proof.put("signature", sign("workforce-activation-v1\n" + digest + "\n" + publicKey));
        return proof;
    }
    boolean protects(String value) {
        if (!TrustedOrigin.employee(origin, value)) return false;
        try { return !"/employee/device-clock".equals(new URI(value).getRawPath()); } catch (Exception ignored) { return false; }
    }
    synchronized Map<String, String> headers(String method, String value) throws Exception {
        if (!protects(value) || !method.matches("GET|HEAD|POST|PUT|PATCH|DELETE")) throw new IllegalArgumentException("Untrusted request");
        URI uri = new URI(value);
        String target = uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
        if (serverSeconds == 0 || SystemClock.elapsedRealtime() - sampledAt > 15 * 60 * 1000) syncClock();
        String time = Long.toString(serverSeconds + (SystemClock.elapsedRealtime() - sampledAt) / 1000);
        byte[] random = new byte[16]; new SecureRandom().nextBytes(random);
        String nonce = hex(random);
        Map<String, String> proof = new LinkedHashMap<>();
        proof.put("X-Workforce-Time", time); proof.put("X-Workforce-Nonce", nonce);
        proof.put("X-Workforce-Proof", sign("workforce-device-v1\n" + method + "\n" + target + "\n" + time + "\n" + nonce));
        return proof;
    }
    synchronized private void syncClock() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(origin + "/employee/device-clock").openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(10000); connection.setReadTimeout(10000);
        connection.setRequestProperty("Accept", "application/json");
        try {
            if (connection.getResponseCode() != 200) throw new java.io.IOException("Clock unavailable");
            try (java.io.InputStream input = connection.getInputStream()) {
                java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
                byte[] bytes = new byte[256]; int count;
                while ((count = input.read(bytes)) != -1) {
                    if (output.size() + count > 1024) throw new java.io.IOException("Invalid clock response");
                    output.write(bytes, 0, count);
                }
                JSONObject response = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
                serverSeconds = response.getLong("timestamp");
                if (serverSeconds < 1000000000L) throw new java.io.IOException("Invalid clock");
                sampledAt = SystemClock.elapsedRealtime();
            }
        } finally { connection.disconnect(); }
    }
}
