package com.workforce.reporting.pilot;

import java.net.URI;

/** Exact origin; no wildcard origins, credentials, token queries or arbitrary navigation. */
final class TrustedOrigin {
    static boolean same(String configured, String value) {
        try {
            URI expected = new URI(configured);
            URI actual = new URI(value);
            return "https".equals(expected.getScheme()) && "https".equals(actual.getScheme())
                && expected.getHost() != null && expected.getHost().equalsIgnoreCase(actual.getHost())
                && actual.getRawUserInfo() == null && actual.getPort() == expected.getPort();
        } catch (Exception ignored) { return false; }
    }
    static boolean employee(String configured, String value) {
        if (!same(configured, value)) return false;
        try {
            String path = new URI(value).getRawPath();
            return "/employee".equals(path) || (path != null && path.startsWith("/employee/"));
        } catch (Exception ignored) { return false; }
    }
    static boolean activation(String configured, String value) {
        if (!same(configured, value)) return false;
        try {
            URI uri = new URI(value);
            return "/employee/activate".equals(uri.getRawPath()) && uri.getRawQuery() == null
                && uri.getRawFragment() != null && uri.getRawFragment().matches("[A-Za-z0-9]{64}");
        } catch (Exception ignored) { return false; }
    }
}
