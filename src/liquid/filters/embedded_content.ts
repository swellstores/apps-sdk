import { LiquidSwell } from '..';
import { unescape } from 'lodash-es';

// {{ iframe | embedded_content }} // iframe by default
// {{ iframe | embedded_content: 'video' }}

export default function bind(_liquidSwell: LiquidSwell) {
  return (value: string, tag = 'iframe') => {
    // escape main tags to keep them
    const escapeIframes = value
      .replaceAll(`<${tag}`, `&lt;${tag}`)
      .replaceAll(`</${tag}`, `&lt;/${tag}`);
    // remove all tags
    const removeTags = escapeIframes.replaceAll(/<(.*?)>/gi, '');
    // unescape
    const unescaped = unescape(removeTags);
    // replace spaces
    const replaceSpaces = unescaped.replaceAll('&nbsp;', ' ');
    return replaceSpaces;
  };
}
