import { Component, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { ShelfScreen } from '@/components/shelf-screen'
import { ShelfProvider } from '@/lib/store'

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="grid min-h-dvh place-items-center px-6 text-center">
          <div>
            <p className="text-2xl font-bold">화면을 열지 못했어요</p>
            <button type="button" className="mt-4 text-sm underline" onClick={() => window.location.reload()}>
              새로고침
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ShelfProvider>
        <ShelfScreen />
        <Toaster position="top-center" />
      </ShelfProvider>
    </AppErrorBoundary>
  )
}
