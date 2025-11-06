import React from "react";
import "../styles/TermsAndConditions.css";
import Header from "./Header";
import Footer from "./Footer";
import { useNavigate } from "react-router-dom";
import terms from '../assets/images/terms.png'
const TermsAndConditions = () => {
    const navigate = useNavigate();
  return (
    <>
      <Header />
      <div className="terms-container">

        <div className="help-topbar">
        {/* <button className="help-back-btn" onClick={() => navigate('/profile')}>
          ←
        </button> */}
        <h3>Terms & Conditions</h3>
      </div>

        <div className="terms-header">
          <div className="terms-banner">
            <img
              src={terms}
              alt="JioYatri Terms & Conditions Banner"
              className="terms-image"
            />
            
          </div>
        </div>
       <div className="terms-header">
        <h1>Terms & Conditions</h1>
      </div>
        <div className="terms-content">
          <section>
            <h2>Introduction</h2>
            <p>
              These Terms & Conditions (“Terms”) govern your use of the JioYatri
              platform, including the JioYatri User Application, JioYatri Partner
              Application, and the JioYatri website (collectively, the
              “Applications”). The Applications are owned and operated by{" "}
              <strong>Mokshambani Tech Services Pvt. Ltd.</strong>
            </p>
            <p>
              By accessing or using any part of the Applications, you agree to be
              bound by these Terms. Please read them carefully before using our
              services.
            </p>
            <p>
              We may modify or update these Terms from time to time. Continued use
              of our Applications after such changes constitutes your acceptance
              of the revised Terms.
            </p>
          </section>

          <section>
            <h2>Eligibility</h2>
            <ul>
              <li>Be at least 18 years old;</li>
              <li>Have the legal capacity to enter into a binding agreement; and</li>
              <li>Use the Applications in compliance with applicable laws of India.</li>
            </ul>
            <p>
              By using our Applications, you represent that you meet all
              eligibility requirements.
            </p>
          </section>

          <section>
            <h2>Scope of Services</h2>
            <p>
              JioYatri offers a multi-service platform that connects:
            </p>
            <ul>
              <li>
                <strong>Users</strong> – who can book vehicles to send or receive
                parcels, or place orders from registered business owners (shops,
                hotels, groceries, etc.);
              </li>
              <li>
                <strong>Drivers</strong> – who deliver parcels, goods, or shop
                orders to customers; and
              </li>
              <li>
                <strong>Business Owners</strong> – who register their shops, list
                items, and sell products to users.
              </li>
            </ul>
            <p>
              We act as a technology intermediary, enabling seamless coordination
              between Users, Drivers, and Business Owners. We do not own or
              operate vehicles, delivery fleets, or retail shops. All services are
              provided by independent third-party partners registered on our
              platform.
            </p>
          </section>

          <section>
            <h2>User Responsibilities</h2>
            <ul>
              <li>Provide accurate pickup and delivery details;</li>
              <li>
                Ensure goods or items comply with all applicable laws (no
                restricted or illegal goods);
              </li>
              <li>Pay applicable charges, including shop payment and delivery fees;</li>
              <li>Provide the correct OTPs to Drivers during pickup and delivery;</li>
              <li>Treat all Drivers and Business Owners with respect.</li>
            </ul>
            <p>
              You are solely responsible for the correctness of addresses, item
              details, and payment confirmations.
            </p>
          </section>

          <section>
            <h2>Partner (Driver & Business Owner) Responsibilities</h2>

            <h3>For Drivers</h3>
            <ul>
              <li>Accept orders only through the JioYatri Partner App.</li>
              <li>Safely collect, transport, and deliver parcels or goods.</li>
              <li>Verify pickup and delivery OTPs.</li>
              <li>Comply with all road safety and licensing laws.</li>
              <li>
                Any damage or delay due to negligence may result in suspension or
                termination.
              </li>
            </ul>

            <h3>For Business Owners</h3>
            <ul>
              <li>Register with valid business details and UPI payment credentials.</li>
              <li>Sell only legal and permitted items.</li>
              <li>
                Ensure product quality, packaging, pricing, and timely order
                acceptance.
              </li>
              <li>
                Payment for goods is made directly to your registered UPI account.
              </li>
              <li>Cooperate with Drivers for smooth pickup and delivery.</li>
            </ul>
          </section>

          <section>
            <h2>Ownership and Intellectual Property</h2>
            <p>
              All design, content, graphics, code, and trademarks displayed on the
              Applications are owned by or licensed to{" "}
              <strong>Mokshambani Tech Services Pvt. Ltd.</strong>
            </p>
            <ul>
              <li>Do not copy, modify, reproduce, or sell any part of the Applications.</li>
              <li>Do not reverse engineer or misuse the platform.</li>
              <li>
                Do not use our brand names “JioYatri” without
                permission.
              </li>
            </ul>
          </section>

          <section>
            <h2>Prohibited Use</h2>
            <ul>
              <li>
                Upload or transport illegal, dangerous, or restricted goods
                (weapons, drugs, explosives, animals);
              </li>
              <li>Misuse the app to harass or defraud others;</li>
              <li>Interfere with app functioning or spread viruses;</li>
              <li>Access data or accounts you’re not authorized to use.</li>
            </ul>
            <p>
              Violation of these provisions may lead to permanent suspension and
              legal action.
            </p>
          </section>

          <section>
            <h2>Payments and Charges</h2>
            <ul>
              <li>Users must pay delivery fees based on distance and vehicle type.</li>
              <li>
                Shop Orders: item amount is paid directly to the shop owner’s UPI,
                delivery fee to the driver.
              </li>
              <li>Drivers receive payment after completing deliveries.</li>
              <li>
                Cancellation after acceptance may incur applicable cancellation
                fees.
              </li>
              <li>
                All applicable taxes or surcharges (GST or others) are borne by
                the relevant party.
              </li>
            </ul>
          </section>

          <section>
            <h2>Restricted Items</h2>
            <ul>
              <li>Explosives, firearms, or ammunition</li>
              <li>Liquids, flammable materials, or chemicals</li>
              <li>Alcohol, tobacco, or narcotics</li>
              <li>Human or animal parts, perishables, or illegal substances</li>
            </ul>
          </section>

          <section>
            <h2>Liability and Limitations</h2>
            <p>
              JioYatri acts only as a facilitator between Users, Drivers, and
              Business Owners. We are not responsible for:
            </p>
            <ul>
              <li>Loss, theft, or damage to goods during transit;</li>
              <li>Delays due to weather, traffic, or external factors;</li>
              <li>Disputes regarding item quality, quantity, or payment.</li>
            </ul>
            <p>
              In case of proven system errors, liability is limited to the
              delivery fee paid for that order.
            </p>
          </section>

          <section>
            <h2>Indemnity</h2>
            <p>
              You agree to indemnify and hold harmless{" "}
              <strong>Mokshambani Tech Services Pvt. Ltd.</strong> and its
              employees from any claims, losses, or liabilities arising from misuse
              of the Applications or violation of these Terms.
            </p>
          </section>

          <section>
            <h2>Communication and Notifications</h2>
            <p>
              By using the Applications, you agree to receive electronic
              communications (SMS, email, app notifications, or WhatsApp) related
              to your orders and updates.
            </p>
          </section>

          <section>
            <h2>User-Generated Content & Feedback</h2>
            <p>
              Any reviews, feedback, or comments you provide become the property
              of <strong>Mokshambani Tech Services Pvt. Ltd.</strong> and may be
              used for marketing or improvement purposes.
            </p>
          </section>

          {/* <section>
          <h2>Termination</h2>
          <p>
            We may suspend or terminate your account without notice for breach
            of Terms, misuse, or illegal activity. Upon termination, all rights
            under these Terms immediately cease.
          </p>
        </section> */}

          <section>
            <h2>Privacy Policy</h2>
            <p>
              Our Privacy Policy explains how we collect, use, and safeguard your
              personal data. By using our Applications, you consent to this
              processing.
            </p>
          </section>

          {/* <section>
          <h2>Dispute Resolution and Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of India. All disputes shall fall under the jurisdiction of
            the courts of Bengaluru, Karnataka.
          </p>
        </section> */}

          <section>
            <h2>Limitation of Damages</h2>
            <p>
              In no event shall <strong>Mokshambani Tech Services Pvt. Ltd.</strong>
              or its affiliates be liable for any indirect, incidental, or
              consequential damages, including loss of data, revenue, or business.
            </p>
          </section>

          <section>
            <h2>Severability</h2>
            <p>
              If any provision of these Terms is found invalid or unenforceable,
              the remaining provisions shall continue in full force and effect.
            </p>
          </section>

          {/* <section>
          <h2>Grievance Officer</h2>
          <p>
            In accordance with the IT Rules, 2021:
            <br />
            <strong>Company:</strong> Mokshambani Tech Services Pvt. Ltd. <br />
            <strong>Email:</strong>{" "}
            <a href="mailto:support@jioyatri.com">support@jioyatri.com</a> <br />
            <strong>Time:</strong> Monday to Friday, 9:00 AM – 6:00 PM
          </p>
        </section> */}

          <section>
            <h2>Acceptance of Terms</h2>
            <p>
              By continuing to use JioYatri Applications, you acknowledge that you
              have read, understood, and agreed to these Terms & Conditions in
              full.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default TermsAndConditions;
