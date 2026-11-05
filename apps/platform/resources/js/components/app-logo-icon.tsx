import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 40 42"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                fillRule="evenodd"
                d="M11 3h18a5 5 0 0 1 5 5v29a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V8a5 5 0 0 1 5-5Zm1 11v3h16v-3H12Zm0 8v3h12v-3H12Zm0 8v3h16v-3H12Z"
            />
        </svg>
    );
}
