export function isValidLotSize(
    quantity: string,
    minQty: string,
    maxQty: string,
    stepSize: string,
): boolean {
    const qty = parseFloat(quantity)
    const min = parseFloat(minQty)
    const max = parseFloat(maxQty)
    const step = parseFloat(stepSize)
    console.log(
        qty,
        min,
        max,
        step,
        "qty, min, max, step",
        typeof qty,
        typeof min,
        typeof max,
        typeof step,
    )
    console.log("qty >= min:", qty >= min) // Should be true
    console.log("qty <= max:", qty <= max) // Should be true
    console.log("(qty - min) % step:", (qty - min) % step) // Should be 0

    if (qty < min || qty > max) {
        console.log("qty < min || qty > max", "NOT VALID")
        return false
    }

    console.log("valid")
    return true
    // return (qty - min) % step === 0;
}
