import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import Dither from './Dither.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('App root was not found.');
createRoot(root).render(
  <>
    <Dither
      className="dither-background"
      waveColor="#9d85be"
      backgroundColor="transparent"
      colorNum={2}
      pixelSize={5}
      ditherMode="bayer4"
      waveSpeed={0.015}
      waveFrequency={2.7}
      waveAmplitude={0.28}
      brightness={-0.08}
      enableMouseInteraction={false}
      clickRipple
      intro={false}
      disableAnimation={window.matchMedia('(max-width: 700px), (prefers-reduced-motion: reduce)').matches}
      dpr={1}
    />
    <App />
  </>
);
