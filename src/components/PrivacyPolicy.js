import React from 'react';
import '../styles/PrivacyPolicy.css';
import Header from './Header';
import Footer from './Footer';
const PrivacyPolicy = () => {
  return (
    <>
    <Header/>
    <div className="privacy-container">
      <header className="privacy-header">
        <h1>JioYatri Privacy Policy</h1>
      </header>

      <section className="privacy-section">
        <h2>Overview</h2>
        <p>
          This privacy policy sets out how JioYatri uses and protects any information that you provide when you use our 
          website <a href="https://jioyatri.com">https://jioyatri.com</a> or mobile applications (collectively, "JioYatri Platform"). 
          Your privacy matters to us and we are committed to protecting your personal information.
        </p>
        <p>
          This Privacy Policy ("Policy") describes how we collect, use, disclose, and protect your information when you use 
          our platform, whether as a customer, delivery partner, or business owner.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Information We Collect</h2>
        <p>We may collect the following types of information:</p>
        <ul className="info-list">
          <li><strong>Personal Information:</strong> Name, email address, phone number, address</li>
          <li><strong>Service Information:</strong> Pickup/delivery locations, item descriptions, payment details</li>
          <li><strong>Business Information:</strong> For registered businesses (shop details, inventory, contact info)</li>
          <li><strong>Location Data:</strong> Precise location for delivery services when the app is in use</li>
          <li><strong>Payment Information:</strong> For cash transactions or Razorpay payments (we don't store full card details)</li>
          <li><strong>Driver Partner Information:</strong> For delivery partners (vehicle details, license, insurance documents,Vehicle RC)</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>How We Use Your Information</h2>
        <p>We use the collected information for the following purposes:</p>
        <div className="usage-grid">
          <div className="usage-card">
            <h3>Service Delivery</h3>
            <p>To provide and manage our logistics and delivery services</p>
          </div>
          <div className="usage-card">
            <h3>Business Services</h3>
            <p>To connect users with registered businesses (hotels, groceries, etc.)</p>
          </div>
          <div className="usage-card">
            <h3>Payments</h3>
            <p>To process payments for services rendered</p>
          </div>
          <div className="usage-card">
            <h3>Communication</h3>
            <p>To send service updates, notifications, and promotional offers</p>
          </div>
          <div className="usage-card">
            <h3>Improvements</h3>
            <p>To analyze usage patterns and improve our services</p>
          </div>
          <div className="usage-card">
            <h3>Security</h3>
            <p>To prevent fraud and ensure platform security</p>
          </div>
        </div>
      </section>

      <section className="privacy-section">
        <h2>Information Sharing</h2>
        <p>We may share your information in the following circumstances:</p>
        <ul className="info-list">
          <li>With delivery partners to fulfill your service requests</li>
          <li>With registered businesses when you place orders</li>
          <li>With payment processors for transaction completion</li>
          <li>With law enforcement when required by law</li>
          <li>With service providers who assist in our operations</li>
        </ul>
        <p>We never sell your personal information to third parties.</p>
      </section>

      <section className="privacy-section">
        <h2>Data Security</h2>
        <p>
          We implement appropriate security measures to protect your information, including encryption, 
          access controls, and secure servers. However, no internet transmission is 100% secure.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul className="info-list">
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your personal data</li>
          <li>Opt-out of marketing communications</li>
          <li>Withdraw consent for data processing</li>
        </ul>

      </section>


      <section className="privacy-section">
        <h2>Changes to This Policy</h2>
        <p>
          We may update this policy periodically. We'll notify you of significant changes through the 
          platform or via email.    
        </p>
      </section>

      <section className="privacy-section">
        <h2>Contact Us</h2>
        <div className="contact-info">
          <h3>MOKSHAMBANI TECH SERVICES PVT. LTD</h3>
          <p><a href="https://jioyatri.com">https://jioyatri.com</a></p>
          <p>Email: <a href="helpjioyatri@gmail.com">helpjioyatri@gmail.com</a></p>
          <p>Phone: 9844559599</p>
          <p>Address: Ward. No. 10 Opp. Ramamandira Choultry N R Extension , CHINTAMANI-563125,Chickkaballapur Dist</p>
        </div>
        <p>
          For general inquiries, please email <a href="helpjioyatri@gmail.com">helpjioyatri@gmail.com</a>
        </p>
      </section>
    </div>
    <Footer/>
    </>
  );
};



export default PrivacyPolicy;
