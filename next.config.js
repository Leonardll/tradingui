/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: true,
    },
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            net: false,
            os: false,
        }
        return config
    },
    images: {
        domains: ["cryptocompare.com"],
        remotePatterns: [
            {
                protocol: "https",
                hostname: "cryptocompare.com",
                port: "",
                pathname: "/media/",
            },
        ],
    },
}

module.exports = nextConfig
