import { CompositionProvider } from './context/CompositionContext'
import TopBar from './components/TopBar'
import CanvasArea from './components/CanvasArea'
import BottomToolbar from './components/BottomToolbar'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'
import './index.css'

export default function App() {
  return (
    <CompositionProvider>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'var(--bg-base)',
      }}>
        <TopBar />

        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <div style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}>
            <CanvasArea />
            <BottomToolbar />
          </div>

          <RightPanel />
        </div>

        <StatusBar />
      </div>
    </CompositionProvider>
  )
}
