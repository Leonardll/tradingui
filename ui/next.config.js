/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: true,
        appDir: true,
        serverComponentsExternalPackages: ["mongoose"]

    },
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            net: false,
            os: false,
        },
        config.experiments = { ...config.experiments, topLevelAwait: true }
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
