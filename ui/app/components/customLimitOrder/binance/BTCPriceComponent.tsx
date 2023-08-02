"use client"


import { useEffect, useState } from 'react';

function BTCPriceComponent() {
  const [btcPrice, setBtcPrice] = useState(null);

  useEffect(() => {
    fetch('/api/priceFeed') // replace with your actual endpoint
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log(data); // log the fetched data
        const btcData = data.data.filter(item => item.symbol === 'BTCUSDT');
        console.log(btcData); // log the filtered data
        if (btcData.length > 0) {
          setBtcPrice(btcData[0].price);
        }
      })
      .catch(error => {
        console.log('There was an error!', error);
      });
  }, []);

  useEffect(() => {
    console.log(btcPrice);
  }, [btcPrice]);

  return (
    <div>
      Current BTC price: {btcPrice}
    </div>
  );
}

export default BTCPriceComponent;
