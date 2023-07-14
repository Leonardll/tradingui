// utils/orderService.ts
import fs from 'fs';
import path from 'path';

const ordersDir = path.join(__dirname, '..', 'orders');

// Check if orders directory exists and create it if not
if (!fs.existsSync(ordersDir)){
    fs.mkdirSync(ordersDir);
}

export function saveOrderData(orderId: string, orderData: object) {
    fs.writeFileSync(path.join(ordersDir, `${orderId}.json`), JSON.stringify(orderData));
}

export function getOrderData(orderId: string) {
    const data = fs.readFileSync(path.join(ordersDir, `${orderId}.json`), 'utf-8');
    return JSON.parse(data);
}

export function updateOrderData(orderId: string, update: object) {
    const orderData = getOrderData(orderId);

    // Here we're just directly assigning the update to the orderData
    // You might want to handle different types of updates differently
    Object.assign(orderData, update);

    saveOrderData(orderId, orderData);
}
