import { describeFilter } from '../test-helpers';

describeFilter('embedded_content', (render) => {
  it('should remove all tags except iframe', async () => {
    const iframe =
      "<span id='isPasted'><iframe src='test.com'></span><br /></iframe>";
    const result = await render(`{{ iframe | embedded_content }}`, { iframe });

    expect(result).toBe("<iframe src='test.com'></iframe>");
  });

  it('should perform unescape', async () => {
    const iframe = "&lt;iframe src='test.com'&gt;&lt;/iframe&gt;";
    const result = await render(`{{ iframe | embedded_content }}`, { iframe });

    expect(result).toBe("<iframe src='test.com'></iframe>");
  });

  it('should replace spaces', async () => {
    const iframe = "&lt;iframe&nbsp;&nbsp;src='test.com'&gt;&lt;/iframe&gt;";
    const result = await render(`{{ iframe | embedded_content }}`, { iframe });

    expect(result).toBe("<iframe  src='test.com'></iframe>");
  });

  it('should allow typed embedded content', async () => {
    const iframe =
      "<iframe width='100%' height='100%' src='https://www.youtube.com/embed/NpEaa2P7qZI?si=NQcMz0-jycTcGeaq' title='YouTube video player' frameborder='0' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share' referrerpolicy='strict-origin-when-cross-origin' allowfullscreen></iframe>";

    const result = await render(`{{ iframe | embedded_content }}`, { iframe });

    expect(result).toBe(
      "<iframe width='100%' height='100%' src='https://www.youtube.com/embed/NpEaa2P7qZI?si=NQcMz0-jycTcGeaq' title='YouTube video player' frameborder='0' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share' referrerpolicy='strict-origin-when-cross-origin' allowfullscreen></iframe>",
    );
  });

  it('should transform pasted embedded content', async () => {
    const iframe = `&lt;iframe width=&#39;100%&#39; height=&#39;100%&#39; src=&#39;<a href="https://www.youtube.com/embed/NpEaa2P7qZI?si=NQcMz0-jycTcGeaq" id="isPasted">https://www.youtube.com/embed/NpEaa2P7qZI?si=NQcMz0-jycTcGeaq</a>&#39; title=&#39;YouTube video player&#39; frameborder=&#39;0&#39; allow=&#39;accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share&#39; referrerpolicy=&#39;strict-origin-when-cross-origin&#39; allowfullscreen&gt;&lt;/iframe&gt;<br><br>`;
    const result = await render(`{{ iframe | embedded_content }}`, { iframe });

    expect(result).toBe(
      "<iframe width='100%' height='100%' src='https://www.youtube.com/embed/NpEaa2P7qZI?si=NQcMz0-jycTcGeaq' title='YouTube video player' frameborder='0' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share' referrerpolicy='strict-origin-when-cross-origin' allowfullscreen></iframe>",
    );
  });

  it('should remove all tags except specified', async () => {
    const content =
      "<span id='isPasted'><video src='test.com'></span><br /></video>";
    const result = await render(`{{ content | embedded_content: 'video' }}`, {
      content,
    });

    expect(result).toBe("<video src='test.com'></video>");
  });
});
