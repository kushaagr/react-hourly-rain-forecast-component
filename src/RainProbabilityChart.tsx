import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

// Interfaces for structured data state
interface HourlyData {
  time: string[];
  precipitation_probability: number[];
}

interface OpenMeteoResponse {
  hourly: HourlyData;
}

export default function RainProbabilityChart() {
  const chartRef = useRef(null);
  const [rawData, setRawData] = useState<HourlyData | null>(null);
  const [dayOffset, setDayOffset] = useState<number>(0); // 0 = Today, 1 = Tomorrow, etc.
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>('Your Location');

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      fetchWeatherData(52.52, 13.41);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationName(`Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`);
        fetchWeatherData(latitude, longitude);
      },
      () => {
        setLocationName('Berlin (Default)');
        fetchWeatherData(52.52, 13.41);
      }
    );
  }, []);

  // Fetch 7 full days of data up-front
  const fetchWeatherData = async (lat: number, lon: number) => {
    try {
      setLoading(true);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation_probability&forecast_days=7&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch weather data');
      const data: OpenMeteoResponse = await response.json();
      
      setRawData(data.hourly);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dynamically compute active 24-hour slice based on dayOffset
  const currentDayData = useMemo(() => {
    if (!rawData) return null;

    const startIdx = dayOffset * 24;
    const endIdx = startIdx + 24;

    const rawTimes = rawData.time.slice(startIdx, endIdx);
    const probabilities = rawData.precipitation_probability.slice(startIdx, endIdx);

    // Format X-axis timestamps (e.g., "04:00")
    const labels = rawTimes.map((timeString) => {
      const date = new Date(timeString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    });

    // Parse the actual target date for display headers
    const targetDate = new Date(rawData.time[startIdx]);
    let dateHeading = targetDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    
    if (dayOffset === 0) dateHeading = 'Today';
    if (dayOffset === 1) dateHeading = 'Tomorrow';

    const peakProbability = Math.max(...probabilities);
    const peakHour = labels[probabilities.indexOf(peakProbability)];

    return { labels, probabilities, dateHeading, peakProbability, peakHour };
  }, [rawData, dayOffset]);

  const chartData = {
    labels: currentDayData?.labels || [],
    datasets: [
      {
        label: 'Rain Probability',
        data: currentDayData?.probabilities || [],
        borderColor: 'rgb(56, 189, 248)',
        borderWidth: 3,
        pointBackgroundColor: 'rgb(56, 189, 248)',
        pointHoverRadius: 15,
        pointRadius: 5,
        tension: 0.4,
        fill: true,
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
          gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          return gradient;
        },
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context: any) => ` 🌧️ ${context.parsed.y}% Chance of Rain`,
        },
      },
    },
    scales: {
      x: { 
        grid: { display: false }, 
        ticks: { 
          color: 'rgb(148, 163, 184)', 
          maxTicksLimit: 12 // Increased granularity requested
        } 
      },
      y: { 
        min: 0, 
        max: 100, 
        ticks: { color: 'rgb(148, 163, 184)', stepSize: 20, callback: (v: any) => `${v}%` }, 
        grid: { color: 'rgba(148, 163, 184, 0.1)' } 
      },
    },
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl h-80 mx-auto flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mb-3"></div>
        <p className="text-slate-400 text-sm">Synchronizing timeline array matrices...</p>
      </div>
    );
  }

  if (error) return <div className="w-full max-w-4xl h-80 mx-auto flex items-center justify-center bg-slate-900 rounded-2xl text-red-400">Error: {error}</div>;

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl mt-6">
      
      {/* Upper Layout: Navigation & Details */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">Rain Probability</h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {currentDayData?.dateHeading}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-1">{locationName}</p>
        </div>

        {/* Dynamic Metric Display Panels */}
        <div className="flex items-center gap-4 text-sm bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-xl self-start sm:self-auto">
          <div>
            <span className="text-slate-500 block text-xs uppercase tracking-wider">Peak Risk</span>
            <span className="text-slate-200 font-semibold">{currentDayData?.peakProbability}%</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <span className="text-slate-500 block text-xs uppercase tracking-wider">Peak Hour</span>
            <span className="text-sky-400 font-medium font-mono">
              {currentDayData && currentDayData.peakProbability > 0 ? currentDayData.peakHour : 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Center Layout: Visual Render Box */}
      <div className="h-72 w-full relative mb-6">
        {currentDayData && <Line ref={chartRef} data={chartData} options={options} />}
      </div>

      {/* Lower Layout: Navigation Interface Control Panel */}
      <div className="flex items-center justify-between border-t border-slate-800/60 pt-4">
        <button
          onClick={() => setDayOffset((prev) => Math.max(0, prev - 1))}
          disabled={dayOffset === 0}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          ← Prev Day
        </button>

        <span className="text-xs font-mono text-slate-500">
          Day Index: {dayOffset + 1} / 7
        </span>

        <button
          onClick={() => setDayOffset((prev) => Math.min(6, prev + 1))}
          disabled={dayOffset === 6}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all bg-sky-500 text-slate-950 hover:bg-sky-400 font-semibold disabled:opacity-30 disabled:hover:bg-sky-500 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          Next Day →
        </button>
      </div>

    </div>
  );
}