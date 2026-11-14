

function makeLabel(scene, x, y, str, size) {
  return scene.add.text(x, y, str, { fontSize: size + 'px', color: '#ffffff' }).setOrigin(0.5);
  }

  function makeSlot(scene, x, y, color) {
    return scene.add.rectangle(x, y, 80, 80, color, 0.35).setStrokeStyle(2, color);
    }

    function makeButton(scene, x, y, name) {
      const b = scene.add.rectangle(x, y, 90, 60, 0x444444)
          .setStrokeStyle(2, 0xffffff)
              .setInteractive();
                makeLabel(scene, x, y, name, 18);
                  b.on('pointerdown', function () { console.log(name + ' pressed'); });
                  }

                  const battleScene = {
                    key: 'Battle',
                      create: function () {
                          const W = this.scale.width;
                              const H = this.scale.height;

                                  this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a2b);

                                      // Top bar
                                          this.add.rectangle(W / 2, 30, W, 60, 0x000000, 0.6);
                                              makeLabel(this, 60, 30, 'HOME', 24);
                                                  makeLabel(this, W / 2 - 80, 30, 'Energy 0/0', 24);
                                                      makeLabel(this, W / 2 + 120, 30, 'Gold 0', 24);

                                                          // 5 slots per side
                                                              for (let i = 0; i < 5; i++) {
                                                                    const y = 140 + i * 100;
                                                                          const stagger = (i % 2) * 40;
                                                                                makeSlot(this, 250 + stagger, y, 0x3366cc);
                                                                                      makeSlot(this, W - 250 - stagger, y, 0xcc3333);
                                                                                          }

                                                                                              // 4 buttons bottom right
                                                                                                  ['Auto', 'Speed', 'Skill', 'Pause'].forEach((name, i) => {
                                                                                                        makeButton(this, W - 60 - (3 - i) * 100, H - 50, name);
                                                                                                            });
                                                                                                              }
                                                                                                              };

                                                                                                              new Phaser.Game({
                                                                                                                type: Phaser.CANVAS,
                                                                                                                  width: 1280,
                                                                                                                    height: 720,
                                                                                                                      backgroundColor: '#000000',
                                                                                                                        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
                                                                                                                          scene: [battleScene],
                                                                                                                          });