type PageHeaderProps = {
  title: string;
  section: string;
  description: string;
};

export function PageHeader({ title, section, description }: PageHeaderProps) {
  return (
    <div className="d-md-flex d-block align-items-center justify-content-between mb-4">
      <div className="my-auto">
        <h4 className="page-title mb-1">{title}</h4>
        <nav>
          <ol className="breadcrumb mb-2">
            <li className="breadcrumb-item">
              <a href="#dashboard">
                <i className="ti ti-home text-primary"></i>
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              {section}
            </li>
          </ol>
        </nav>
        <p className="text-muted mb-0">{description}</p>
      </div>
    </div>
  );
}
