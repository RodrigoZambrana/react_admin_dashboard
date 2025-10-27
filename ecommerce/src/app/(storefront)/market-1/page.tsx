// API FUNCTIONS
import api from "@utils/__api__/market-1";
// PAGE SECTION COMPONENTS
import Section1 from "@sections/market-1/Section1";
import Section2 from "@sections/market-1/Section2";
import Section3 from "@sections/market-1/Section3";
import Section4 from "@sections/market-1/Section4";
import Section5 from "@sections/market-1/Section5";
import Section6 from "@sections/market-1/Section6";
import Section7 from "@sections/market-1/Section7";
import Section8 from "@sections/market-1/Section8";
import Section10 from "@sections/market-1/Section10";
import Section11 from "@sections/market-1/Section11";
import Section12 from "@sections/market-1/Section12";
import Section13 from "@sections/market-1/Section13";

export default async function Market1() {
  const [
    carList,
    carBrands,
    mobileList,
    opticsList,
    mobileShops,
    opticsShops,
    mobileBrands,
    opticsBrands
  ] = await Promise.all([
    api.getCarList(),
    api.getCarBrands(),
    api.getMobileList(),
    api.getOpticsList(),
    api.getMobileShops(),
    api.getOpticsShops(),
    api.getMobileBrands(),
    api.getOpticsBrands()
  ]);

  return (
    <main>
     

      {/* HERO CAROUSEL AREA */}
      <Section1 />
        {/* CATEGORIES AREA */}
      <Section10 />
      {/* SERVICES AREA */}
      <Section12 />
    
      {/* FLASH DEAL PRODUCTS AREA */}
      <Section2 />

      {/* TOP CATEGORIES AREA */}
      {/* <Section3 /> */}

      {/* TOP RATING AND BRANDS AREA */}
      <Section4 />

      {/* NEW ARRIVALS AREA */}
      <Section5 />

      {/* BIG DISCOUNT AREA */}
      <Section13 />

      {/* CAR LIST AREA */}
      <Section6 carBrands={carBrands} carList={carList} />

      {/* MOBILE PHONES AREA */}
      {/* <Section7
        shops={mobileShops}
        brands={mobileBrands}
        title="Mobile Phones"
        productList={mobileList}
      /> */}

      {/* DISCOUNT BANNERS AREA */}
      <Section8 />

      {/* OPTICS AND WATCH AREA */}
      {/* <Section7
        shops={opticsShops}
        brands={opticsBrands}
        title="Optics / Watch"
        productList={opticsList}
      /> */}

      {/* MORE PRODUCTS AREA */}
      <Section11 />
    </main>
  );
}
