'use client';


import Image from 'next/image'
import { useEffect, useState } from 'react';
import { Doughnut} from "react-chartjs-2";
import {Chart, ArcElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Context } from  'chartjs-plugin-datalabels';
import CustomLimitOrder from './components/customLimitOrder/binance/CustomLimitOrder';
Chart.register(ArcElement, CategoryScale, LinearScale, Tooltip, Legend);
const DoughnutChartComponent = ({ data, priceFeed }) => {
 // console.log(priceFeed);
  const busdValue = (asset) => {
    const symbol = asset + 'BUSD'
    const assetValue = priceFeed?.data?.find((price) => price.symbol === symbol)
    return assetValue ? parseFloat(assetValue?.price) : null
  }

  // Calculate the total BUSD value of the portfolio
  let totalBusdValue = 0;
  if (data) {
    data.forEach(item => {
      const busdPrice = busdValue(item.asset);
      totalBusdValue += (parseFloat(item.free) + parseFloat(item.locked)) * (busdPrice ? busdPrice : 0);
    });
  }


  const filteredData =  data ? data?.filter(item => parseFloat(item.locked) > 0 ) : [];
  const filteredData2 = data? data?.filter(item => parseFloat(item.free) > 1) : [];

  const combinedData = [...filteredData, ...filteredData2];
  // Calculate percentages for each asset
  let percentages1 = combinedData.map(item => {
    const busdPrice = busdValue(item.asset);
    return ((parseFloat(item.locked) * (busdPrice ? busdPrice : 0)) / totalBusdValue) * 100;
  });
  
  let percentages2 = combinedData.map(item => {
    const busdPrice = busdValue(item.asset);
    return ((parseFloat(item.free) * (busdPrice ? busdPrice : 0)) / totalBusdValue) * 100;
  });

  // Generate labels with percentages for Wallet
  let labelsWithPercentages1 = combinedData.map((item, i) => `${item.asset} - ${percentages1[i].toFixed(2)}%`);

  // Generate labels with percentages for Portfolio
  let labelsWithPercentages2 = combinedData.map((item, i) => `${item.asset} - ${percentages2[i].toFixed(2)}%`);

  
  const chartData = {
    labels: labelsWithPercentages1,
    datasets: [
      {
        label:  'Wallet',
        data: combinedData.map(item => parseFloat(item.free) + parseFloat(item.locked)),
        labels: labelsWithPercentages2,
        hoverOffset: 6,
        backgroundColor: [
          'rgba(248, 2, 2, 0.2)',  // Red
          'rgba(255, 159, 64, 0.2)',  // Orange
          'rgba(255, 206, 86, 0.2)',  // Yellow
          'rgba(75, 192, 192, 0.2)',  // Turquoise
          'rgba(54, 162, 235, 0.2)',  // Blue
          'rgba(34, 51, 202, 0.8)', // Purple
          'rgba(201, 203, 207, 0.2)', // Gray
          'rgba(255, 99, 205, 0.2)',  // Pink
          'rgba(0, 128, 128, 0.2)', // Teal
          'rgba(34, 202, 167, 0.2)', //green
        ],
        borderColor: [
          'rgba(255, 99, 132, 2)',  // Red
          'rgba(255, 159, 64, 2)',  // Orange
          'rgba(255, 206, 86, 2)',  // Yellow
          'rgba(75, 192, 192, 2)',  // Turquoise
          'rgba(54, 162, 235, 2)',  // Blue
          'rgba(153, 102, 255,2)', // Purple
          'rgba(201, 203, 207,2)', // Gray
          'rgba(255, 99, 205, 2)',  // Pink
          'rgba(0, 128, 128,2)', // Teal
          'rgba(0, 128, 2)', // green 
        ],
        borderWidth: 1,
      },
      // {
      //   label:  'Portfolio',
      //   data: combinedData.map(item => parseFloat(item.free) + parseFloat(item.locked)),
      //   labels: labelsWithPercentages2,
      //   hoverOffset: 6,
      //   backgroundColor: ['rgba(54, 162, 235, 0.2)', 'rgba(255, 99, 132, 0.2)'],
      //   borderColor: ['rgba(54, 162, 235, 1)', 'rgba(255, 99, 132, 1)'],
      //   borderWidth: 1,
      // },
    ],
  };

  const options = {
    interaction: {
      mode: 'nearest',
      intersect: true,
      axis: 'x'
    },
    plugins: {
      tooltip: {
        title: 'Total',
        enabled: true,
        position: 'nearest',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        titleFont: {weight: 'bold'},
        bodyColor: '#ffffff',
        callbacks: {
          label: function(context) {
            const dataIndex = context.dataIndex;
        
            // value is the quantity of the asset
            const quantity = context.parsed;  
        
            // Extract the asset name from the label
            const assetName = context.chart.data.labels[dataIndex].split(' - ')[0];
        
            // Retrieve the price of the asset in BUSD
            const assetPriceInBusd = busdValue(assetName); 
        
            // Calculate the value in BUSD
            const valueInBusd = quantity * assetPriceInBusd;
        
            // Form the tooltip string
            let tooltipString = `${assetName}: Value: ${valueInBusd.toFixed(2)} BUSD`;
        
            return tooltipString;
          },
        },
        
        
        
      },
      legend: { 
        display: true,
        position: "top",
        //align: 'center',
        //textAlign: 'center',
        //rtl: true,
        //fullSize: true,
        labels: {
          color: 'rgb(0, 0, 0)',
          //align: 'center',
          padding: 10,
          boxWidth: 15,
          boxHeight: 15,
          textAlign: 'left',
          //rtl: true,
          //maxHeight: 40,
         // maxWidth: 40,
         fullSize: true,
          useBorderRadius: true,
          font: {
            weight: 'bold',
            size: 15
          },
        },
      },
      title: {
        display: true,
        align: 'left',
        padding: 20,
        position: 'left',  
      },
    }
  };

  return (
    <div className='text-white'>
      <Doughnut data={chartData} options={options} />
    </div>
  );
};

export default function Home() {

  const [data, setData] = useState(null);
  const [priceFeed, setPriceFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  

  useEffect(() => {
    fetch('/api/binance') // replace 'your-endpoint' with the correct path to your API endpoint
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error('Error: ' + response.statusText);
        }
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.toString());
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch('/api/priceFeed')
    .then((response) => {
      if(response.ok) {
        return response.json();
      } else {
        throw new Error('Error: ' + response.statusText);
      } 
      
    })
    .then((data) => {
      setPriceFeed(data);

        setLoading(false);
    })
    .catch((error) => {
      setError(error.toString());
      setLoading(false);
    })
  },[])

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }



  
  const busdValue = (asset) => {
    const symbol = asset + 'BUSD'
    const  assetValue = priceFeed?.data?.find((price) => price.symbol === symbol)
    return assetValue ? assetValue?.price : 'not found'
  }

  const btcValue = (asset) => {
    const symbol = asset + 'BTC'
    const  assetValue = priceFeed?.data?.find((price) => price.symbol === symbol)
    return assetValue ? assetValue?.price : 'not found'
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-10">
     <div className="flex flex-col justify-between">
     <h1 className='text-xl text-center'>Binance Account Summary</h1>
     </div>
     <div className="flex flex-col justify-center items-center">
      <p className='text-lg'>Account Type: {data?.data.accountType}</p>
     </div>
     <div className="grid grid-cols-2  grid-flow-col gap-3 place-items-center">
       

       <table className='table-auto'>
          <thead>
            <tr>
              <th className='px-4 py-2'>Asset</th>
              <th className='px-4 py-2'>Free</th>
              <th className='px-4 py-2'>Locked</th>
              <th className='px-4 py-2'>Total</th>
              <th className='px-4 py-2'>BUSD</th>
              <th className='px-4 py-2'>BTC</th>
            </tr>
          </thead>
          <tbody>

      { data?.data?.balances.map((item, index) => {
        const busdresult = busdValue(item.asset) * item.locked
        const btcresult = btcValue(item.asset) * item.locked
        const total = parseFloat(item.free) + parseFloat(item.locked)
        
        return (
          
          item.locked  && item.free > 0 &&
            <tr key={index}>
            <td className='border px-4 py-2'>{item.asset}</td>
            <td className='border px-4 py-2'>{parseFloat(item.free).toFixed(5)}</td>  
            <td className='border px-4 py-2'>{parseFloat(item.locked).toFixed(5)}</td>
            <td className='border px-4 py-2'>{total.toFixed(5)}</td>
            <td className='border px-4 py-2'>{busdresult?.toFixed(2) ? busdresult?.toFixed(2) :  'na'}</td>
            <td className='border px-4 py-2'>{btcresult.toFixed(5)}</td>
            </tr>
            )
            
        
        })
      }
      
      </tbody>
      </table>
       
      <div className="w-3/4 flex justify-center text-center">
      <DoughnutChartComponent  data={data?.data?.balances} priceFeed={priceFeed}/>
      </div>
      </div>
     <div className="flex">
      <h1>Custom Limit Order</h1>
     </div>
      <div className="flex">
        <CustomLimitOrder  />
      </div>  
      {/* Render your data here */}

  

     
    </main>
  )
}
