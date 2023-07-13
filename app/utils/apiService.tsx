const apiService = {
    createOrder: async (order: MyOrder) => {
        const response = await fetch("/api/binance/customOrder", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(order),
        });
        return response;
    },
};

export default apiService;
