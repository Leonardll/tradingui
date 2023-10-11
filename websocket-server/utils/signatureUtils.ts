import crypto from "crypto"

export function generateBinanceSignature(queryString: string, testApiSecret: string): string {
    return crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex")
}
