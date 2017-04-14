import MicroGear from '../src';

let microgear
const param = {
  key: '',
  secret: '',
  id: '',
  alias: '',
};

beforeEach(() => {
  microgear = new MicroGear(param);
})

describe('microgear test', () => {
  it('check constructor full param', () => {
    expect(microgear.gearkey).toBe(param.key);
    expect(microgear.gearsecret).toBe(param.secret);
    expect(microgear.appid).toBe(param.id);
    expect(microgear.gearalias).toBe(param.alias);
    expect(microgear.microgearcache).toBe(`microgear-${param.key}.cache`);
  });
});