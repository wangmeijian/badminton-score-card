import callFunction from '../../unit/callFunction';

const app = getApp()
// 轮询间隔
const ASYNC_INTERVAL = 5000;
// 同步按钮禁用间隔
const DISABLED_ASYNC_INTERVAL = 5000;

Page({
  data: {
    // 21分制
    total: 21,
    maxScore: 30,
    // 是否有权限修改比分
    owner: true,
    // 是否在同步比分
    asyncData: false,
    // 轮询定时器
    asyncTimer: null,
    // 禁用主动触发轮询
    asyncDisable: false,
    game_id: '',
    openid: '',
    // 记录历史分数，便于撤销
    history: [],
    historyIndex: 0,
    // 发球方
    server: '',
    game: {
      game_title: '',
      red: {
        name: '',
        score: ''
      },
      blue: {
        name: '',
        score: ''
      }
    }
  },

  onLoad: function(option) {
    wx.hideLoading();
    this.setData({
      game_id: option.game_id,
      openid: wx.getStorageSync('openid')
    },() => {
      this.getGameById().then(() => {
        this.pollRequest();
      });
    })
  },

  // 查看比分，轮询
  pollRequest(){
    if(!this.data.owner){
      clearInterval(this.data.asyncTimer);
      this.data.asyncTimer = setInterval(() => {
        this.getGameById();
      }, ASYNC_INTERVAL);
    }
  },
  onHide(){
    if(this.data.asyncTimer){
      clearInterval(this.data.asyncTimer);
      this.data.asyncTimer = null;
    }
  },
  onShow() {
    // 界面常亮
    wx.setKeepScreenOn({
      keepScreenOn: true
    })
    if(!this.data.asyncTimer){
      this.pollRequest();
    }
  },
  onUnload(){
    // 关闭界面常亮
    wx.setKeepScreenOn({
      keepScreenOn: false
    })
    if(this.data.asyncTimer){
      clearInterval(this.data.asyncTimer);
      this.data.asyncTimer = null;
    }
  },
  onShareAppMessage(){
    const {game, game_id} = this.data;

    return {
      title: `${game.red.name} VS ${game.blue.name}，${game.red.score} : ${game.blue.score}`,
      path: `/pages/score/index?game_id=${game_id}`
    }
  },

  computed (e) {
    const {dataset} = e.currentTarget;
    const {game, history, server, owner} = this.data;
    let setHistory = () => {
      this.setData({
        historyIndex: 0,
        history: [{
          redScore: game.red.score,
          blueScore: game.blue.score,
          server
        }, ...history]
      })
      // 最多记录50条历史记录
      if(history.length > 50){
        this.setData({
          history: history.slice(0, 50)
        })
      }
    }
    if (!owner || dataset.identifier === 'add' && this.ifGameOver()) return;
     
    if (dataset.identifier === 'add') {
      setHistory();
      game[dataset.team].score += 1
      this.setData({
        game,
        server: dataset.team
      })
      this.updateGameScore();
    }else if(dataset.identifier === 'reset'){
      let _this = this;

      wx.showModal({
        title: '重置比分',
        content: '确定重置比分为0:0？',
        success (res) {
          if (res.confirm) {
            setHistory();
            game['red'].score = 0
            game['blue'].score = 0    
            _this.setData({
              game,
              server: ''
            })
            _this.updateGameScore();  
          }
        }
      })
    }
  },
  updateGameScore() {
    callFunction({
      name: 'curd',
      data: {
        action: 'update',
        game: this.data.game,
        openid: this.data.openid
      }
    })
  },
  /**
   * 判断比赛是否结束
   * @return {Boolean} true:结束, false: 未结束
   */
  ifGameOver () {
    const redScore = this.data.game.red.score
    const blueScore = this.data.game.blue.score
    const { total, maxScore } = this.data
    /**
     * 三种情况，比赛结束
     * 1、有一方得分=30分
     * 2、一方得分=21分且另一方得分<=19（最常见的情况）
     * 3、双方得分都>=20分且<30且分差>=2分
     */
    if (redScore === maxScore || blueScore === maxScore ||
      (redScore === total && blueScore <= 19) || (blueScore === total && redScore <= 19) ||
      (redScore >= 20 && blueScore >= 20 && Math.abs(redScore - blueScore) >= 2)) {
      wx.showToast({
        title: '比赛结束',
        icon: 'none',
        duration: 2000
      })
      return true
    }
    return false
  },
  getGameById(){
    if(this.data.asyncDisable)return;
    this.setData({
      asyncData: true,
      asyncDisable: true
    })
    return callFunction({
      name: 'curd',
      data: {
        action: 'retriveById',
        game_id: this.data.game_id
      }
    }).then(res => {
      if(res.data){
        this.setData({
          game: res.data,
          owner: res.data.create_user_id === this.data.openid,
          asyncData: false
        })
      }else{
        let duration = 3000;

        clearInterval(this.data.asyncTimer);
        wx.showToast({
          title: res.errMsg || '数据不存在',
          icon: 'none',
          duration,
          success: () => {
            setTimeout(() => {
              wx.redirectTo({
                url: `/pages/index/index`
              })
            }, duration)
          }
        })
      }
      setTimeout(() => {
        this.setData({
          asyncDisable: false
        })
      }, DISABLED_ASYNC_INTERVAL)
    })
  },
  undo() {
    const { historyIndex, history } = this.data;

    if(history[historyIndex]){
      const { redScore, blueScore, server } = history[historyIndex];

      this.data.game.red.score = redScore;
      this.data.game.blue.score = blueScore;
      this.setData({
        game: this.data.game,
        historyIndex: historyIndex + 1,
        server
      })
      this.updateGameScore();
    }
  }

})
