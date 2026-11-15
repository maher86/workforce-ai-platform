package com.workforce.reporting.pilot;

import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Sign documents and native media GETs; preserve Capacitor's HTML bridge injection. */
final class SignedWebViewClient extends BridgeWebViewClient {
    private final DeviceSigner signer;
    SignedWebViewClient(Bridge bridge, DeviceSigner signer) { super(bridge); this.signer = signer; }
    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!"GET".equals(request.getMethod()) || !signer.protects(request.getUrl().toString())) return super.shouldInterceptRequest(view, request);
        for (String name : request.getRequestHeaders().keySet()) if ("X-Workforce-Proof".equalsIgnoreCase(name) && !request.isForMainFrame()) return null;
        try {
            Map<String, String> headers = new HashMap<>(request.getRequestHeaders());
            headers.putAll(signer.headers("GET", request.getUrl().toString()));
            WebResourceRequest wrapped = new WebResourceRequest() {
                public Uri getUrl() { return request.getUrl(); }
                public boolean isForMainFrame() { return request.isForMainFrame(); }
                public boolean isRedirect() { return request.isRedirect(); }
                public boolean hasGesture() { return request.hasGesture(); }
                public String getMethod() { return request.getMethod(); }
                public Map<String, String> getRequestHeaders() { return headers; }
            };
            WebResourceResponse html = request.isForMainFrame() ? super.shouldInterceptRequest(view, wrapped) : null;
            if (html != null) return html;
            headers.putAll(signer.headers("GET", request.getUrl().toString()));
            return media(request.getUrl().toString(), headers, 0);
        } catch (Exception ignored) {
            return new WebResourceResponse("text/plain", "UTF-8", 503, "Device proof unavailable", java.util.Collections.singletonMap("Cache-Control", "no-store"),
                new ByteArrayInputStream("[DEVICE-PROOF]".getBytes(StandardCharsets.UTF_8)));
        }
    }
    private WebResourceResponse media(String url, Map<String, String> headers, int redirects) throws Exception {
        if (!signer.protects(url) && redirects == 0) throw new java.io.IOException("Untrusted media");
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
        for (Map.Entry<String, String> header : headers.entrySet()) connection.setRequestProperty(header.getKey(), header.getValue());
        String cookie = CookieManager.getInstance().getCookie(url);
        connection.setRequestProperty("Accept-Encoding", "identity");
        if (cookie != null) connection.setRequestProperty("Cookie", cookie);
        int status = connection.getResponseCode();
        Map<String, String> responseHeaders = new HashMap<>();
        for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
            if (header.getKey() == null) continue;
            if ("Set-Cookie".equalsIgnoreCase(header.getKey())) {
                for (String value : header.getValue()) CookieManager.getInstance().setCookie(url, value);
            } else responseHeaders.put(header.getKey(), android.text.TextUtils.join(", ", header.getValue()));
        }
        if (status >= 300 && status < 400) {
            String next = new URL(new URL(url), connection.getHeaderField("Location")).toString(); connection.disconnect();
            if (redirects >= 3 || !TrustedOrigin.same(url, next)) throw new java.io.IOException("Untrusted redirect");
            Map<String, String> nextHeaders = new HashMap<>(headers); nextHeaders.putAll(signer.headers("GET", next));
            return media(next, nextHeaders, redirects + 1);
        }
        String type = connection.getContentType();
        if (type == null) type = "application/octet-stream";
        String mime = type.split(";", 2)[0];
        InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (input == null) input = new ByteArrayInputStream(new byte[0]);
        InputStream closing = new FilterInputStream(input) {
            @Override public void close() throws java.io.IOException { try { super.close(); } finally { connection.disconnect(); } }
        };
        return new WebResourceResponse(mime, "UTF-8", status, status >= 400 ? "Request denied" : "OK", responseHeaders, closing);
    }
}
