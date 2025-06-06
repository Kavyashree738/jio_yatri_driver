import React from 'react'
import Header from './Header'
import '../styles/Home.css'; 
import HeroSection from './HeroSection';
import Footer from './Footer';


const Home = () => {
  return (
    <div>
     <Header/>
     <HeroSection/> 
      <Footer/> 
    </div>
  )
}

export default Home
