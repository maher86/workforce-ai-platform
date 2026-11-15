type Proof = (request: {
    method: string;
    url: string;
}) => Promise<Record<string, string>>;

export function protectedDeviceTarget(
    value: string,
    origin: string,
): string | null {
    const url = new URL(value, origin);
    if (
        url.origin !== origin ||
        url.username ||
        url.password ||
        !/^\/employee(?:\/|$)/.test(url.pathname) ||
        url.pathname === '/employee/device-clock'
    )
        return null;
    return url.href;
}

// Native only. Keep bodies/idempotency keys/upload progress intact; never send unsigned on failure.
export function installDeviceTransport(
    target: { fetch: typeof fetch; XMLHttpRequest: typeof XMLHttpRequest },
    origin: string,
    proof: Proof,
) {
    const originalFetch = target.fetch;
    const prototype = target.XMLHttpRequest.prototype;
    // Prototype interception intentionally saves methods and supplies the original XHR via .call.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalOpen = prototype.open;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalSend = prototype.send;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalAbort = prototype.abort;
    const contexts = new WeakMap<
        XMLHttpRequest,
        { method: string; url: string | null; sent: boolean }
    >();
    target.fetch = async (input, init) => {
        const request = input instanceof Request ? input : null;
        const url = protectedDeviceTarget(
            typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url,
            origin,
        );
        if (!url) return originalFetch.call(target, input, init);
        const signal = init?.signal ?? request?.signal;
        if (signal?.aborted)
            throw new DOMException('Request cancelled', 'AbortError');
        const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
        const headers = new Headers(init?.headers ?? request?.headers);
        const signed = await proof({ method, url });
        if (signal?.aborted)
            throw new DOMException('Request cancelled', 'AbortError');
        Object.entries(signed).forEach(([name, value]) =>
            headers.set(name, value),
        );
        return originalFetch.call(target, input, { ...init, headers });
    };
    prototype.open = function (
        method: string,
        url: string | URL,
        async: boolean = true,
        username?: string | null,
        password?: string | null,
    ) {
        const protectedUrl = protectedDeviceTarget(String(url), origin);
        if (protectedUrl && !async)
            throw new DOMException(
                'Signed requests must be asynchronous',
                'NotSupportedError',
            );
        contexts.set(this, {
            method: method.toUpperCase(),
            url: protectedUrl,
            sent: false,
        });
        originalOpen.call(this, method, url, async, username, password);
    };
    prototype.abort = function () {
        contexts.delete(this);
        originalAbort.call(this);
    };
    prototype.send = function (
        body?: Document | XMLHttpRequestBodyInit | null,
    ) {
        const context = contexts.get(this);
        if (!context?.url) return originalSend.call(this, body);
        if (context.sent)
            throw new DOMException('Request already sent', 'InvalidStateError');
        context.sent = true;
        void proof({ method: context.method, url: context.url })
            .then((signed) => {
                if (contexts.get(this) !== context) return;
                Object.entries(signed).forEach(([name, value]) =>
                    this.setRequestHeader(name, value),
                );
                originalSend.call(this, body);
            })
            .catch(() => {
                if (contexts.get(this) !== context) return;
                this.dispatchEvent(new Event('error'));
                this.dispatchEvent(new Event('loadend'));
            });
    };
    return () => {
        target.fetch = originalFetch;
        prototype.open = originalOpen;
        prototype.send = originalSend;
        prototype.abort = originalAbort;
    };
}
