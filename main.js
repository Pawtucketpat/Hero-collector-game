document.body.insertAdjacentHTML('afterbegin', '<div style="position:fixed;top:0;left:0;z-index:99;color:#0f0;font:20px sans-serif">main.js running</div>');

class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

    create() {
        const W = this.scale.width;
            const H = this.scale.height;

                this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a2b);

                    // Top bar
                        this.add.rectangle(W / 2, 30, W, 60, 0x000000, 0.6);
                            this.label(60, 30, 'HOME');
                                this.label(W / 2 - 80, 30, 'Energy 0/0');
                                    this.label(W / 2 + 120, 30, 'Gold 0');

                                        // 5 slots per side
                                            for (let i = 0; i < 5; i++) {
                                                  const y = 140 + i * 100;
                                                        const stagger = (i % 2) * 40;
                                                              this.slot(250 + stagger, y, 0x3366cc);
                                                                    this.slot(W - 250 - stagger, y, 0xcc3333);
                                                                        }

                                                                            // 4 buttons bottom right
                                                                                ['Auto', 'Speed', 'Skill', 'Pause'].forEach((name, i) => {
                                                                                      this.button(W - 60 - (3 - i) * 100, H - 50, name);
                                                                                          });
                                                                                            }

                                                                                              label(x, y, str) {
                                                                                                  return this.add.text(x, y, str, { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
                                                                                                    }

                                                                                                      slot(x, y, color) {
                                                                                                          return this.add.rectangle(x, y, 80, 80, color, 0.35).setStrokeStyle(2, color);
                                                                                                            }

                                                                                                              button(x, y, name) {
                                                                                                                  const b = this.add.rectangle(x, y, 90, 60, 0x444444)
                                                                                                                        .setStrokeStyle(2, 0xffffff)
                                                                                                                              .setInteractive();
                                                                                                                                  this.label(x, y, name).setFontSize(18);
                                                                                                                                      b.on('pointerdown', () => console.log(name + ' pressed'));
                                                                                                                                        }
                                                                                                                                        }

                                                                                                                                        new Phaser.Game({
                                                                                                                                          type: Phaser.CANVAS,
                                                                                                                                            width: 1280,
                                                                                                                                              height: 720,
                                                                                                                                                backgroundColor: '#000000',
                                                                                                                                                  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
                                                                                                                                                    scene: [BattleScene],
                                                                                                                                                    });