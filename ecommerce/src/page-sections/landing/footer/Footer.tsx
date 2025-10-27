import { IconHeartFilled } from "@tabler/icons-react";
import Icon from "@component/icon/Icon";
import { Wrapper } from "./styles";

export default function Footer() {
  return (
    <Wrapper py="4rem">
      <div className="footer-content">
        <p className="footer-text">
          Developed with <IconHeartFilled size={16} className="heart-icon" /> & Care by UI Lib
        </p>

        <div className="social-icons">
          {iconList.map((item) => (
            <a href={item.url} target="_blank" rel="noreferrer noopenner" key={item.iconName}>
              <Icon size="1rem" mx="0.5rem">
                {item.iconName}
              </Icon>
            </a>
          ))}
        </div>
      </div>
    </Wrapper>
  );
}

const iconList = [
  { iconName: "facebook-1", url: "https://www.facebook.com/UILibOfficial" },
  { iconName: "twitter-1", url: "/" },
  { iconName: "youtube-1", url: "https://www.youtube.com/channel/UCsIyD-TSO1wQFz-n2Y4i3Rg" },
  { iconName: "instagram-1", url: "/" }
];
