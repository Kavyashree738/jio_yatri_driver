// import React, { useState, useEffect } from 'react';
// import { DateRangePicker } from 'react-date-range';
// import { enIN } from 'date-fns/locale';
// import 'react-date-range/dist/styles.css';
// import 'react-date-range/dist/theme/default.css';
// import moment from 'moment';
// import 'moment/locale/en-in';
// import '../styles/DailyEarningsFilter.css';

// moment.locale('en-in');

// const DailyEarningsFilter = ({ paymentSettlements, registrationDate, onFilter }) => {
//   // console.log('Component rendered with props:', {
//   //   paymentSettlements,
//   //   registrationDate,
//   //   paymentSettlementsCount: paymentSettlements?.length
//   // });

//   const getDefaultDateRange = () => {
//     const endDate = new Date();
//     let startDate = new Date();
//     startDate.setDate(startDate.getDate() - 7);

//     if (registrationDate) {
//       const regDate = new Date(registrationDate);
//       if (regDate > startDate) {
//         startDate = regDate;
//       }
//     }

//     // Adjust based on existing settlements
//     if (paymentSettlements?.length > 0) {
//       const firstDate = new Date(paymentSettlements[0].date);
//       if (firstDate < startDate) {
//         startDate = firstDate;
//       }
//     }

//     return [{
//       startDate,
//       endDate,
//       key: 'selection'
//     }];
//   };

//   const [dateRange, setDateRange] = useState(getDefaultDateRange());
//   const [showDatePicker, setShowDatePicker] = useState(false);
//   const [filteredEarnings, setFilteredEarnings] = useState([]);
//   const [windowWidth, setWindowWidth] = useState(window.innerWidth);

//   useEffect(() => {
//     const handleResize = () => setWindowWidth(window.innerWidth);
//     window.addEventListener('resize', handleResize);
//     return () => window.removeEventListener('resize', handleResize);
//   }, []);

//   useEffect(() => {
//     filterPayments();
//   }, [dateRange, paymentSettlements]);

//   const filterPayments = () => {
//     if (!paymentSettlements?.length) {
//       setFilteredEarnings([]);
//       onFilter([]);
//       return;
//     }

//     const start = moment(dateRange[0].startDate).startOf('day');
//     const end = moment(dateRange[0].endDate).endOf('day');

//     const filtered = paymentSettlements.filter(settlement => {
//       if (!settlement?.date) return false;
//       const paymentDate = moment(settlement.date);
//       return paymentDate.isBetween(start, end, null, '[]');
//     });

//     setFilteredEarnings(filtered);
//     onFilter(filtered);
//   };

//   const formatDate = (dateString) => {
//     return moment(dateString).format('MMM D, YYYY');
//   };

//   return (
//     <div className="earnings-filter-container">
//       <div className="filter-header">
//         <h3>Daily Earnings</h3>
//         <div className="filter-actions">
//           <button
//             onClick={() => setShowDatePicker(!showDatePicker)}
//             className="filter-btn"
//           >
//             {showDatePicker ? 'Hide Filter' : `Filter: ${formatDate(dateRange[0].startDate)} - ${formatDate(dateRange[0].endDate)}`}
//           </button>
//           <button onClick={() => {
//             setDateRange(getDefaultDateRange());
//             setShowDatePicker(false);
//           }} className="reset-btn">
//             Reset
//           </button>
//         </div>
//       </div>

//       {showDatePicker && (
//         <div className="date-picker-wrapper">
//           <div className="date-picker-container">
//             <DateRangePicker
//               locale={enIN}
//               onChange={item => setDateRange([item.selection])}
//               showSelectionPreview={true}
//               moveRangeOnFirstSelection={false}
//               months={windowWidth < 768 ? 1 : 2}
//               ranges={dateRange}
//               direction="horizontal"
//               minDate={registrationDate ? new Date(registrationDate) : new Date(2020, 0, 1)}
//               maxDate={new Date()}
//               editableDateInputs={true}
//             />
//             <div className="date-picker-actions">
//               <button onClick={() => setShowDatePicker(false)} className="apply-btn">
//                 Apply
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       <div className="earnings-list">
//         {filteredEarnings.length > 0 ? (
//           filteredEarnings.map((earning, index) => (
//             <div key={earning._id || index} className="earning-item">
//               <div className="earning-date">
//                 {formatDate(earning.date)}
//               </div>
//               <div className="earning-details">
//                 <div className="earning-row">
//                   <span>Cash Collected:</span>
//                   <span>₹{(earning.cashCollected || 0).toFixed(2)}</span>
//                 </div>
//                 <div className="earning-row">
//                   <span>Online Collected:</span>
//                   <span>₹{(earning.onlineCollected || 0).toFixed(2)}</span>
//                 </div>
//                 <div className="earning-row">
//                   <span>Status:</span>
//                   <span>{earning.status || 'unknown'}</span>
//                 </div>
//               </div>
//             </div>
//           ))
//         ) : (
//           <div className="no-earnings">
//             {paymentSettlements?.length > 0 ? (
//               <>
//                 <p>No earnings found for selected period</p>
//                 <p>Try expanding your date range</p>
//               </>
//             ) : (
//               "No earnings data available yet"
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default DailyEarningsFilter;


import React, { useState, useEffect } from 'react';
import moment from 'moment';
import 'moment/locale/en-in';
import '../styles/DailyEarningsFilter.css';
import { useTranslation } from "react-i18next";
moment.locale('en-in');

const DailyEarningsFilter = ({ paymentSettlements, registrationDate, onFilter }) => {
  const getDefaultDateRange = () => {
    const endDate = new Date();

    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    if (registrationDate) {
      const regDate = new Date(registrationDate);
      if (regDate > startDate) startDate = regDate;
    }

    if (paymentSettlements?.length > 0) {
      const firstDate = new Date(paymentSettlements[0].date);
      if (firstDate < startDate) startDate = firstDate;
    }

    return [{ startDate, endDate, key: 'selection' }];
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filteredEarnings, setFilteredEarnings] = useState([]);
  const { t } = useTranslation();


  const toInput = (d) => moment(d).format('YYYY-MM-DD');
  const fromInput = (s) => (s ? new Date(s + 'T00:00:00') : new Date());
  const today = new Date();
  const minDateObj = registrationDate ? new Date(registrationDate) : new Date(2020, 0, 1);

  useEffect(() => {
    filterPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, paymentSettlements]);

  const filterPayments = () => {
    if (!paymentSettlements?.length) {
      setFilteredEarnings([]);
      onFilter([]);
      return;
    }

    const start = moment(dateRange[0].startDate).startOf('day');
    const end = moment(dateRange[0].endDate).endOf('day');

    const filtered = paymentSettlements.filter((settlement) => {
      if (!settlement?.date) return false;
      const paymentDate = moment(settlement.date);
      return paymentDate.isBetween(start, end, null, '[]'); // inclusive
    });

    setFilteredEarnings(filtered);
    onFilter(filtered);
  };

  const formatDate = (d) => moment(d).format('MMM D, YYYY');

  const setStart = (value) => {
    const s = fromInput(value);
    setDateRange(([curr]) => {
      const end = curr.endDate < s ? s : curr.endDate;
      return [{ ...curr, startDate: s, endDate: end }];
    });
  };

  const setEnd = (value) => {
    const e = fromInput(value);
    setDateRange(([curr]) => {
      const start = curr.startDate > e ? e : curr.startDate;
      return [{ ...curr, endDate: e, startDate: start }];
    });
  };

  const applyPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    // respect registration min date
    if (registrationDate) {
      const reg = new Date(registrationDate);
      if (reg > start) start.setTime(reg.getTime());
    }
    setDateRange([{ startDate: start, endDate: end, key: 'selection' }]);
    setShowDatePicker(false);
  };

  return (
    <div className="earnings-filter-container">
      <div className="filter-header">
        <div className="filter-actions">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="filter-btn"
          >
            {showDatePicker
              ? t("filter_button_hide")
              : `${t("filter_button_show")}: ${formatDate(dateRange[0].startDate)} - ${formatDate(dateRange[0].endDate)}`}

          </button>
          <button
            onClick={() => {
              setDateRange(getDefaultDateRange());
              setShowDatePicker(false);
            }}
            className="reset-btn"
          >
            {t("reset_button")}
          </button>
        </div>
      </div>

      {showDatePicker && (
        <div className="date-picker-wrapper">
          <div className="date-picker-container">
            <div className="date-inputs">
              <label className="date-field">
                <span>{t("from_label")}</span>
                <input
                  type="date"
                  value={toInput(dateRange[0].startDate)}
                  min={toInput(minDateObj)}
                  max={toInput(dateRange[0].endDate)}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className="date-field">
                <span>{t("to_label")}</span>
                <input
                  type="date"
                  value={toInput(dateRange[0].endDate)}
                  min={toInput(dateRange[0].startDate)}
                  max={toInput(today)}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>

            <div className="quick-presets">
              <button onClick={() => applyPreset(7)} className="preset-btn"> {t("last_7_days")}</button>
              <button onClick={() => applyPreset(30)} className="preset-btn">{t("last_30_days")}</button>
              <button
                onClick={() => {
                  const end = new Date();
                  const start = minDateObj;
                  setDateRange([{ startDate: start, endDate: end, key: 'selection' }]);
                  setShowDatePicker(false);
                }}
                className="preset-btn"
              >
                {t("all_time")}

              </button>
            </div>

            <div className="date-picker-actions">
              <button onClick={() => setShowDatePicker(false)} className="apply-btn">
                {t("apply_button")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="earnings-list">
        {filteredEarnings.length > 0 ? (
          filteredEarnings.map((earning, index) => (
            <div key={earning._id || index} className="earning-item">
              <div className="earning-date">{formatDate(earning.date)}</div>
              <div className="earning-details">
                <div className="earning-row">
                  <span>{t("cash_collected")}:</span>
                  <span>₹{(earning.cashCollected || 0).toFixed(2)}</span>
                </div>
                <div className="earning-row">
                  <span>{t("online_collected")}:</span>
                  <span>₹{(earning.onlineCollected || 0).toFixed(2)}</span>
                </div>

                {/* 👇 NEW - Driver paid to Owner */}
                {earning.driverToOwner > 0 && (
                  <div className="earning-row">
                    <span>{t("driver_to_owner")}:</span>
                    <span className="negative">₹{earning.driverToOwner.toFixed(2)}</span>
                  </div>
                )}

                {/* 👇 NEW - Owner paid to Driver */}
                {earning.ownerToDriver > 0 && (
                  <div className="earning-row">
                    <span>{t("owner_to_driver")}:</span>
                    <span className="positive">₹{earning.ownerToDriver.toFixed(2)}</span>
                  </div>
                )}

                <div className="earning-row">
                  <span>{t("status")}:</span>
                  <span>{earning.status || 'unknown'}</span>
                </div>

                {/* 👇 Optional - SettledAt date */}
                {earning.status === 'settled' && earning.settledAt && (
                  <div className="earning-row">
                    <span>{t("settled_at")}:</span>
                    <span>{moment(earning.settledAt).format('MMM D, YYYY')}</span>
                  </div>
                )}
              </div>

            </div>
          ))
        ) : (
          <div className="no-earnings">
            {paymentSettlements?.length > 0 ? (
              <>
                <p>{t("no_earnings_period")}</p>
                <p>{t("try_expand_range")}</p>
              </>
            ) : (
              <p>{t("no_earnings_available")}</p>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default DailyEarningsFilter;