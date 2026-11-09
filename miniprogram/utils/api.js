module.exports = async (action, data = {}) => {
  if (!getApp().globalData.configured) throw new Error('请先配置微信云环境');
  const { result } = await wx.cloud.callFunction({ name: 'gymApi', data: { action, data } });
  if (!result || !result.ok) throw new Error(result && result.error || '服务暂时不可用');
  return result.data;
};
