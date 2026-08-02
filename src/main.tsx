import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { LanguageProvider } from './i18n'
import Layout from './components/Layout'
import Home from './pages/Home'
import Country from './pages/Country'
import Taiwan from './pages/Taiwan'
import Companies from './pages/Companies'
import About from './pages/About'
import Explore from './pages/Explore'
import AI from './pages/AI'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'explore', element: <Explore /> },
      { path: 'country/:iso3', element: <Country /> },
      { path: 'taiwan', element: <Taiwan /> },
      { path: 'ai', element: <AI /> },
      { path: 'companies', element: <Companies /> },
      { path: 'about', element: <About /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <RouterProvider router={router} />
    </LanguageProvider>
  </StrictMode>
)
