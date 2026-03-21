const navbarNavigations = [
  {
    title: "Home",
    child: [
      { title: "Storefront", url: "/" }
    ]
  },
  {
    title: "Pages",
    child: [
      {
        title: "Shop",
        child: [
          { title: "Search product", url: "/product/search/mobile phone" },
          { title: "Single product", url: "/product/lord-2019" },
          { title: "Cart", url: "/cart" },
          { title: "Checkout", url: "/checkout" }
        ]
      },
      {
        title: "Auth",
        child: [
          { title: "Sign In", url: "/account/login" },
          { title: "Sign Up", url: "/account/register" }
        ]
      }
    ]
  },
  {
    title: "User Account",
    child: [
      {
        title: "Orders",
        child: [
          { title: "Order List", url: "/account/orders" },
          { title: "Order Details", url: "/account/orders/f0ba538b-c8f3-45ce-b6c1-209cf07ba5f8" }
        ]
      },
      {
        title: "Profile",
        child: [
          { title: "View Profile", url: "/account/profile" },
          { title: "Edit Profile", url: "/account/profile/edit" }
        ]
      },
      {
        title: "Address",
        child: [
          { title: "Address List", url: "/account/address" },
          { title: "Add Address", url: "/account/address/create" }
        ]
      },
      {
        title: "Support tickets",
        child: [
          { title: "All tickets", url: "/account/support-tickets" },
          { title: "Ticket details", url: "/account/support-tickets/product-broken.-i-need-refund" }
        ]
      },
      { title: "Wishlist", url: "/account/wish-list" }
    ]
  },
  { title: "Track My Orders", url: "/account/orders" },
  { title: "Back to Demos", url: "/" }
  // {
  //   title: "Documentation",
  //   url:
  //     "https://docs.google.com/document/d/13Bnyugzcty75hzi9GdbVh01YV75a7AhViZws0qGf5yo/edit?usp=sharing",
  //   extLink: true,
  // },
];

export default navbarNavigations;
