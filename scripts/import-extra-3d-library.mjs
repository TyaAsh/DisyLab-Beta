import sharp from 'sharp'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceDir = 'E:\\资料库\\3D\\新建文件夹'
const destinationDir = join(root, 'public', 'prompt-library', 'local')
const catalogPath = join(root, 'public', 'prompt-library', 'catalog.json')
const maxDimension = 1024

const entries = [
  ['124a92212433989.6734cee9860dc 1.jpg', '摇滚主唱夸张舞台角色', '青绿色摄影棚背景，一名留棕色长发与络腮胡的夸张3D摇滚主唱全身站立，仰头张嘴高歌，右手把复古银色麦克风举到嘴边，左手握黑色电吉他，穿米白背心、紧身牛仔裤和尖头皮鞋；低机位广角，头部和手部略夸张，脚下青色地面投下清晰软阴影，暖橙轮廓光与冷青背景形成电影级撞色'],
  ['31a4351e-9c22-4989-9dd7-3a267687ae83.png', 'AI投资助理吉祥物', '黑蓝方形金融科技KV，中央是一只橙白相间的3D小牛/小虎吉祥物，头戴金色护目镜，穿橙色披风和浅色连体服，向前奔跑并双手托起两块青蓝透明全息数据屏；背景是深色交易终端、红绿K线和细密网格，顶部三行白橙中文标题，角色周围有青色数据粒子和速度光带'],
  ['3c504351-661d-4c51-8991-99005d9d83a1.png', '加密冲击波英雄KV', '暖白竖版加密主题海报，中央是圆润橙白3D吉祥物半身，穿蓝色超级英雄披风与胸甲，胸前嵌金色比特币徽章；角色抬头望向右上，身后爆发橙、粉、蓝三色放射速度光束，底部有模糊运动残影；顶部用黑蓝粗体写加密周标题，整体像高速冲击波中的英雄出场'],
  ['40c27603-b0ae-4b01-90d9-fff9b1c06fe1.png', '少年投资家招募海报', '橙黑竖版金融招募海报，中央下方是一只穿黑西装白衬衫、戴黑色墨镜的橙白3D吉祥物，双手向外摊开，周围漂浮美元纸币；背景由深红到橙色渐变并带金色光晕，顶部密集排列大号白色和橙色中文标题，右侧放橙色圆角行动按钮，幽默但专业的商业KV'],
  ['54d039247121651.69d41a8a2a517 1.jpg', '苔藓生态巨人', '灰绿色纯色背景，一名体型敦实的超现实3D男性角色正面向镜头奔跑，戴蓝色护目镜，蓬松棕色卷发，胸腹覆盖真实苔藓、灌木和微型树木，裸露手臂粗壮，穿黄色短裤、白袜和棕色鞋；角色采用玩具般圆润比例，植被细节真实，柔和棚拍光与脚下短阴影'],
  ['636a70247124035.69d427056a5c1 1.jpg', '昆虫眼复古列车', '浅色木地板上的微缩超现实机械生物，一辆墨绿色复古有轨电车被改造成昆虫形态，车头伸出两根细长黑色触角，顶端各是一颗黄绿色球形眼睛；车身有黄黑条纹、窗格、金属铆钉和轮轨细节，低角度微距摄影，背景严重虚化，阴天柔光、旧玩具质感'],
  ['729914c2-ad88-443c-96ef-2893dfca695a 1.jpg', '恐龙武士重甲肖像', '暗红摄影棚背景，一名巨大的拟人恐龙武士正面站立，绿色蜥蜴头从厚重圆形铁甲上方探出，嘴微张；身体穿锈蚀的日本武士板甲，肩甲宽大，腰间垂挂金属护片，顶部升起红色烟雾般盔缨；正面对称构图，硬质顶光，铜锈、划痕和油污极其清晰'],
  ['7d3ed9247173249.69d526d03d479 1.jpg', '马首绅士红披风', '灰绿色旧墙背景，一名超现实拟人马首绅士侧身行走，细长马头朝左，穿浅灰色三件套西装、白衬衫和领带，外披一件长及小腿的鲜红色披风；一只手向前优雅抬起，另一只手藏在身后，黑色皮鞋，完整全身构图，复古时装摄影与轻微胶片颗粒'],
  ['7e7842f9-afcb-4be6-9cae-1d0e3fd52f9d.png', '个人投资者报告KV', '浅蓝竖版金融报告封面，顶部左对齐巨大白色中文标题“年度个人投资者报告”；右侧是一卷向后展开的白色立体报告纸，纸边带绿色按钮和圆形图标；左下橙白3D吉祥物骑在蓝色铅笔火箭上向右上飞，底部堆叠金币、金色币章和黑色AI小机器人，清爽企业插画'],
  ['83236a216729277.6785360b08b01 1.jpg', '城市高空BMX特技', '横版城市运动广告，一名戴头盔的BMX骑手在高楼之间腾空做车把旋转特技，人物与自行车位于画面中央偏上，车架形成清晰黑色圆弧轨迹；背景是暖色日光下虚化的现代楼群，低机位仰拍，浅景深、橙青电影调色和速度感'],
  ['8407b905-a4a1-4a95-be65-1a24472278d0 1.jpg', '模块织物手臂角色', '纯青蓝背景的超现实3D角色正面特写，身体像一块竖直的米色软垫，左右伸出两条写实人类手臂自然下垂；胸前由橙色花纹织物、蓝色牛仔布和米色布料拼成模块化服装，右下挂一枚黑色小型相机；材质突出皮肤、缝线、织物纤维和软垫压痕，对称棚拍'],
  ['8aa9e3247173249.69d526d03d7d2 1.jpg', '低机位历史重甲卫士', '昏暗岩洞与火光背景，一名历史重甲卫士从极低机位被仰拍，人物占满竖版画面；他戴红金头盔与护鼻，穿深蓝长袖、红色交叉胸带、皮革腰包和金属护腰，双臂垂下，背后橙红火焰照亮岩壁；史诗电影光、粗粝皮革与金属纹理'],
  ['8b8e1178-cb02-4739-8fe6-d7007e00e8eb.png', 'Mr Right择股吉祥物', '深蓝方形金融海报，左上两行白色中文标题，中央偏右是一只橙白3D小牛吉祥物半身，闭眼自信微笑，手托红色爱心；角色背后有蓝色星光、柔焦散景和斜向光束，左下用黄色斜体大字写“Mr. Right”，甜蜜约会主题与选股隐喻结合'],
  ['98db3f247173249.69d526d0403ac 1.jpg', '复古巨型工业机器人', '废弃工业建筑中，一台巨大复古人形机器人从低机位俯视镜头，方形灰蓝金属头、窄眼、厚重橙色胸甲、银色圆柱手臂和锈蚀腿甲；身体遍布螺栓、油渍、划痕和褪色编号，背景为高窗射入的黄绿色尘雾，1970年代科幻电影质感'],
  ['9b2753247173249.69d526d03f62b 1.jpg', '荒原摔跤机器人', '浅灰荒原与岩壁背景，一名粗壮的复古摔跤机器人全身站立，戴深色面罩，黄色短袖上衣外穿红黑腰带，棕色机械腿和黑色拳套；双臂抬起做备战姿势，低机位仰拍，身体有磨损、锈迹与粗糙橡胶，日光从左上照入形成硬阴影'],
  ['9feb3d247173249.69d526d03c6ec 1.jpg', '靶心电视头旅人', '黄绿色昏暗室内，一名坐在复古行李箱上的超现实人物，身体穿棕色粗花呢毛衣和皮手套，头部是一台橄榄绿色老式圆角电视机，屏幕显示红黄同心靶图；双手自然搭在膝上，人物偏右构图，左侧留暗部，胶片颗粒、钨丝灯与诡异复古氛围'],
  ['b5a3dcd6-b4b1-412f-8c28-f1e773cbe9b8.png', '太空IPO火箭吉祥物', '蓝黑竖版航天金融海报，右侧一枚巨大的银灰白色商业火箭从地球弧面斜向右上冲出，火箭尾部有蓝白喷焰；左下橙白3D吉祥物穿白色宇航服漂浮，胸前带X形徽章；顶部白橙超粗标题写太空IPO主题，背景有星空、地球云层和强烈蓝色轮廓光'],
  ['bc7a1d00-2736-4c2e-9470-f04d56227a26.png', '限量礼品互动横幅', '深蓝横版金融活动广告，右侧一只橙白3D吉祥物穿蓝色太空服，从紫蓝发光交易屏后探出并挥手；左侧是白色中文活动标题，其中“获取限量礼品”使用巨大橙色粗体，下方两条深色圆角信息条写日期和地点；背景有霓虹行情曲线、网格与紫色边光'],
  ['c1aea0247173249.69d526d03fcf1 1.jpg', '蓝毛王座怪兽', '阴暗废墟中的电影级怪兽肖像，一只高大的蓝色长毛人形生物坐在铁制王座上，双腿分开，手臂搭在扶手，面部隐藏在阴影；左侧青绿色冷光勾勒毛发，右侧红色火光和铁架形成强烈对比，地面散落碎石，低机位正面对称构图'],
  ['d99a276f-a786-404b-bac2-584dcc2e23a4.png', '橙色投资者报告封面', '亮橙竖版年度投资报告封面，顶部以白色粗体写“年度投资者报告”；中央是一只放大的橙白3D吉祥物半身，睁大眼睛张嘴惊讶，一手托发光绿色水晶球，另一手托微缩白色城市建筑，前景叠放巨大的金色比特币，明亮棚拍和简洁纯色背景'],
  ['dc9a4a50-0a9b-45f6-acec-2660fd005d80.png', '美股互动活动横幅', '黑橙横版金融活动海报，左侧密集排列白色活动说明和橙色大标题“获取限定礼品”，底部放日期地点信息；右侧橙白3D吉祥物站在金币圆台上，举起一台白色手机展示橙色应用图标，周围漂浮金币；背景是黑色渐变、橙色光环和细密行情线'],
  ['dd6aaa28-9239-4823-8e06-533879785072 1.jpg', '面包岩石孤独角色', '米黄色极简空间，一名由粗糙面包屑和砂岩材质构成的超现实人形角色坐在方形石凳上，身体肥厚、头部低垂、双臂垂在膝间；背后竖立一块巨大的方形面包岩壁，地面铺细沙，整体同色系，柔和顶光、寂静雕塑装置感'],
  ['eb49a4b6-d963-4cb0-be40-d53cf8c9fe70.png', '牛牛兔兔恋爱电影海报', '蓝色竖版浪漫电影海报，前景是一只白色长耳兔和一只橙白3D小牛并肩坐在蓝色座椅上，小牛举起手机像在约会，兔子微笑侧看；背景为虚化的夜间电影院与蓝色灯光，顶部用白色中文手写体标题，画面边缘有电影节桂冠标识，柔和梦幻光晕'],
  ['fc1c80e0-28cb-42f2-bbff-148d2ec9c0c1.png', 'AI全民交易终端', '黑色竖版金融科技海报，中央是一台圆润白色AI机器人头像，黑色玻璃面罩内有青色发光椭圆眼睛，底部橙色圆台产生镜面反射；背景是深色交易终端、红绿K线和数据表，顶部白橙大标题写AI普及交易，机器人右侧悬浮紫色声波面板，青橙霓虹轮廓光'],
]

const nanoPrompt = (scene) => `生成一张完整的商业3D视觉作品：${scene}。严格执行主体数量、姿态、镜头、元素位置、文字区和留白。此提示词可直接用于文生图；如同时上传参考图，则进一步锁定原图比例、构图、造型与主色。品牌和小字使用无版权虚构内容，不要水印、乱码、重复物体、畸形肢体或低清噪点。`
const gptImage2Prompt = (scene) => `生成一张可直接发布的高精度商业3D视觉。\n\n画面复现：${scene}。\n\n构图：仅凭本提示词即可完整生成，严格保持上述主体比例、镜头透视、前中后景、文字区与负空间；若提供参考图，则以参考图进一步约束画幅、轮廓、版式和阅读顺序。\n\n质感：准确表现皮肤、织物、金属、玻璃、毛发或软陶等指定材质，光影方向明确，边缘锐利。品牌标识改成无版权占位符，避免乱码、水印、多余肢体、重复物体和生成瑕疵。`

const main = async () => {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  await mkdir(destinationDir, { recursive: true })
  const ids = new Set(entries.map((_, offset) => `local-reference-${String(55 + offset).padStart(3, '0')}`))
  const retained = catalog.cases.filter((item) => !ids.has(item.id))
  const added = []

  for (const [offset, [sourceName, title, scene]] of entries.entries()) {
    const index = 55 + offset
    const source = join(sourceDir, sourceName)
    const extension = extname(sourceName).toLowerCase() === '.png' ? 'png' : 'jpg'
    const filename = `local-${String(index).padStart(3, '0')}.${extension}`
    const destination = join(destinationDir, filename)
    const metadata = await sharp(source).rotate().metadata()
    const largestEdge = Math.max(metadata.width || 0, metadata.height || 0)
    if (largestEdge > maxDimension) {
      const image = sharp(source).rotate().resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      if (extension === 'png') await image.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(destination)
      else await image.jpeg({ quality: 92, mozjpeg: true }).toFile(destination)
    } else {
      await cp(source, destination)
    }
    added.push({
      id: `local-reference-${String(index).padStart(3, '0')}`,
      title,
      image: `/prompt-library/local/${filename}`,
      sourceLabel: '本地资料库',
      category: '3D视觉',
      styles: [],
      scenes: [],
      featured: false,
      prompt: nanoPrompt(scene),
      nanoPrompt: nanoPrompt(scene),
      gptImage2Prompt: gptImage2Prompt(scene),
    })
  }

  catalog.cases = [...retained, ...added].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  catalog.totalCases = catalog.cases.length
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`Added ${added.length} 3D references. Catalog now contains ${catalog.totalCases} cases.`)
}

await main()
