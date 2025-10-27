import NextImage, { ImageProps } from "next/image";
import styled from "styled-components";
import { border, color, space, ColorProps, BorderProps, SpaceProps, compose } from "styled-system";

type LazyImageProps = ImageProps & BorderProps & SpaceProps & ColorProps;

const styles = compose(color, space, border);

const LazyImage = styled(({ borderRadius, ...props }: LazyImageProps) => {
  return <NextImage {...props} />;
})<LazyImageProps>`
  ${styles}
`;

export default LazyImage;
