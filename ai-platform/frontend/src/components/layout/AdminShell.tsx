import type { PropsWithChildren } from 'react';

export type AdminNavigationItem = {
  key: string;
  label: string;
  icon: string;
  href: string;
};

type AdminShellProps = PropsWithChildren<{
  activeKey: string;
  currentLabel: string;
  navigationItems: AdminNavigationItem[];
}>;

export function AdminShell({
  activeKey,
  currentLabel,
  navigationItems,
  children,
}: AdminShellProps) {
  return (
    <>
      <div id="global-loader">
        <div className="page-loader"></div>
      </div>
      <div className="main-wrapper admin-platform-shell">
        <div className="header">
          <div className="header-left active">
            <a href="#dashboard" className="logo logo-normal">
              <img
                src="/dreamschat-admin/assets/img/full-logo.svg"
                alt="DreamsChat"
              />
            </a>
            <a href="#dashboard" className="logo-small">
              <img
                src="/dreamschat-admin/assets/img/logo-small.svg"
                alt="DreamsChat"
              />
            </a>
          </div>

          <a id="mobile_btn" className="mobile_btn" href="javascript:void(0);sidebar">
            <span className="bar-icon">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </a>

          <div className="header-user">
            <div className="nav user-menu">
              <div className="nav-item nav-search-inputs me-auto">
                <div className="top-nav-search">
                  <a href="javascript:void(0);" className="responsive-search">
                    <i className="fa fa-search"></i>
                  </a>
                  <div className="d-flex align-items-center">
                    <a id="toggle_btn" href="javascript:void(0);" className="me-2">
                      <i className="ti ti-menu-2"></i>
                    </a>
                    <form action="javascript:void(0);" className="dropdown">
                      <div className="searchinputs" id="dropdownMenuClickable">
                        <input type="text" value={currentLabel} readOnly />
                        <div className="search-addon">
                          <span>
                            <i className="ti ti-layout-grid"></i>
                          </span>
                        </div>
                        <div className="search-addon-command">
                          <span>
                            <i className="ti ti-command"></i>
                          </span>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center">
                <div className="provider-head-links">
                  <div className="dark-mode">
                    <a
                      href="javascript:void(0);"
                      id="dark-mode-toggle"
                      className="dark-mode-toggle header-icon"
                    >
                      <i className="fa-regular fa-moon"></i>
                    </a>
                    <a
                      href="javascript:void(0);"
                      id="light-mode-toggle"
                      className="dark-mode-toggle header-icon"
                    >
                      <i className="ti ti-sun-filled"></i>
                    </a>
                  </div>
                </div>
                <div className="dropdown">
                  <a
                    href="javascript:void(0);"
                    className="header-icon flag-icon"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <img
                      src="/dreamschat-admin/assets/img/flag/flag-03.png"
                      alt="Language"
                      className="img-fluid rounded-pill"
                    />
                  </a>
                  <div className="dropdown-menu dropdown-menu-right p-3">
                    <a
                      href="javascript:void(0);"
                      className="dropdown-item active d-flex align-items-center"
                    >
                      <img
                        className="me-2 rounded-pill"
                        src="/dreamschat-admin/assets/img/flag/flag-03.png"
                        alt="Spanish"
                        height="22"
                        width="22"
                      />
                      Operator locale aware
                    </a>
                    <a
                      href="javascript:void(0);"
                      className="dropdown-item d-flex align-items-center"
                    >
                      <img
                        className="me-2 rounded-pill"
                        src="/dreamschat-admin/assets/img/flag/flag-01.png"
                        alt="English"
                        height="22"
                        width="22"
                      />
                      Managed resources
                    </a>
                  </div>
                </div>
                <div className="provider-head-links">
                  <a
                    href="#dashboard"
                    className="d-flex align-items-center justify-content-center header-icon active-dot"
                  >
                    <i className="ti ti-layers-linked fs-16"></i>
                  </a>
                </div>
                <div className="dropdown">
                  <a href="javascript:void(0);" data-bs-toggle="dropdown">
                    <div className="booking-user d-flex align-items-center">
                      <span className="user-img me-2">
                        <img
                          src="/dreamschat-admin/assets/img/users/user-08.jpg"
                          alt="Operator"
                        />
                      </span>
                      <div>
                        <h6 className="fs-14 fw-medium">Demo Tenant</h6>
                        <span className="text-primary fs-12">Platform Operator</span>
                      </div>
                    </div>
                  </a>
                  <ul className="dropdown-menu p-2">
                    <li>
                      <a
                        className="dropdown-item d-flex align-items-center"
                        href="javascript:void(0);"
                      >
                        <i className="ti ti-shield me-1"></i>Governed workspace
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="dropdown mobile-user-menu">
            <a
              href="javascript:void(0);"
              className="nav-link dropdown-toggle"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="fa fa-ellipsis-v"></i>
            </a>
            <div className="dropdown-menu dropdown-menu-end">
              <a className="dropdown-item" href="#dashboard">
                Dashboard
              </a>
              <a className="dropdown-item" href="#chat-test-center">
                Chat Test Center
              </a>
              <a className="dropdown-item" href="#knowledge-center">
                Knowledge Center
              </a>
              <a className="dropdown-item" href="#prompts">
                Prompts
              </a>
              <a className="dropdown-item" href="#critical-configs">
                Critical configs
              </a>
            </div>
          </div>
        </div>

        <div className="sidebar" id="sidebar">
          <div className="sidebar-inner slimscroll">
            <div id="sidebar-menu" className="sidebar-menu d-flex flex-column">
              <ul className="menu-top">
                {navigationItems.map((item) => (
                  <li
                    key={item.key}
                    className={item.key === activeKey ? 'active' : undefined}
                  >
                    <a href={item.href}>
                      <i className={item.icon}></i>
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <ul className="menu-bottom">
                <li>
                  <a href="#dashboard">
                    <i className="ti ti-building-store"></i>
                    <span>Tenant: demo-tenant</span>
                  </a>
                </li>
                <li>
                  <a href="#chat-test-center">
                    <i className="ti ti-flask-2"></i>
                    <span>Wave 7 test center</span>
                  </a>
                </li>
                <li>
                  <a href="#knowledge-center">
                    <i className="ti ti-brain"></i>
                    <span>Knowledge workflows</span>
                  </a>
                </li>
                <li>
                  <a href="#knowledge-center">
                    <i className="ti ti-clock-bolt"></i>
                    <span>Wave 8 dependency noted</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="page-wrapper">
          <div className="content container-fluid">{children}</div>
        </div>
      </div>
    </>
  );
}
