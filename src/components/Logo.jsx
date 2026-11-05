import { ASSETS } from '../config/event.js';

/** Original transparent logos, shown at their native proportions. */
export function TitleLogo({ className = '', alt = ASSETS.logoTitle.alt, ...rest }) {
  const { src, width, height } = ASSETS.logoTitle;
  return <img className={`logo logo--title ${className}`} src={src} width={width} height={height} alt={alt} decoding="async" {...rest} />;
}

export function NamesLogo({ className = '', alt = ASSETS.logoNames.alt, ...rest }) {
  const { src, width, height } = ASSETS.logoNames;
  return <img className={`logo logo--names ${className}`} src={src} width={width} height={height} alt={alt} decoding="async" {...rest} />;
}
