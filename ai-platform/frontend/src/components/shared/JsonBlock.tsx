type JsonBlockProps = {
  value: unknown;
};

export function JsonBlock({ value }: JsonBlockProps) {
  return (
    <pre className="react-json-block">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}
