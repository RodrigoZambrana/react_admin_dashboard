import Typography, { H3 } from "@component/Typography";

interface ProductSpecificationsProps {
  specifications?: Array<{ label: string; value: string }>;
}

export default function ProductSpecifications({
  specifications = []
}: ProductSpecificationsProps) {
  if (specifications.length === 0) {
    return (
      <Typography color="text.muted">
        Specification information will be available soon.
      </Typography>
    );
  }

  return (
    <div>
      <H3 mb="0.75rem">Specifications</H3>

      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {specifications.map((item, index) => (
          <li
            key={`${item.label ?? "spec"}-${index}`}
            style={{
              display: "flex",
              gap: "0.75rem",
              padding: "0.35rem 0",
              borderBottom: "1px solid rgba(15, 23, 42, 0.08)"
            }}>
            <Typography fontWeight={500} minWidth="140px">
              {item.label}
            </Typography>
            <Typography color="text.muted">{item.value}</Typography>
          </li>
        ))}
      </ul>
    </div>
  );
}
