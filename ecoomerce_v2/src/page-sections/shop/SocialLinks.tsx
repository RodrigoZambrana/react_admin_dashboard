import {
  IconBrandFacebook,
  IconBrandTwitter,
  IconBrandYoutube,
  IconBrandInstagram
} from "@tabler/icons-react";
import FlexBox from "@component/FlexBox";
import { StyledLink } from "./styles";

const socialLinks = [
  { id: 1, url: "https://facebook.com", Icon: IconBrandFacebook },
  { id: 2, url: "https://twitter.com", Icon: IconBrandTwitter },
  { id: 3, url: "https://youtube.com", Icon: IconBrandYoutube },
  { id: 4, url: "https://instagram.com", Icon: IconBrandInstagram }
];

export default function SocialLinks() {
  return (
    <FlexBox my="8px" style={{ gap: ".5rem" }}>
      {socialLinks.map(({ id, url, Icon }) => (
        <StyledLink key={id} href={url} target="_blank" rel="noreferrer noopener">
          <Icon size={18} />
        </StyledLink>
      ))}
    </FlexBox>
  );
}
