// public/js/components/AudioRecorderModal.js

window.AudioRecorderModal = ({ isOpen, onClose, onPost }) => {
  // [修正] 全てのフックをコンポーネントの最上位に移動
  const { useState, useEffect, useRef } = React;
  const { Mic, Play, Pause, Send, Trash2 } = window.Icons;

  const [recordingState, setRecordingState] = useState('idle');
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [countdown, setCountdown] = useState(15);
  const [supportedMimeType, setSupportedMimeType] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // [修正] useEffectも他のフックと共にトップレベルに配置
  useEffect(() => {
    // useEffectの内部でisOpenをチェックするのは問題ない
    if (!isOpen) return;

    const mimeTypes = [
        'audio/mp4',
        'audio/ogg; codecs=opus',
        'audio/webm; codecs=opus',
        'audio/webm',
        'audio/aac'
    ];
    const foundType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
    
    if (foundType) {
        setSupportedMimeType(foundType);
    } else {
        window.ErrorHandler.report('audio', 'サポートされている録音形式がありません。', { severity: 'error' });
    }
    // コンポーネントがアンマウントされる（モーダルが閉じる）際にクリーンアップ処理を実行
    return () => {
      cleanup();
    }
  }, [isOpen]);

  // [修正] isOpenがfalseの場合は、フックを呼び出した後でnullを返す
  if (!isOpen) {
    return null;
  }
  
  const cleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
        clearInterval(timerRef.current);
    }
    chunksRef.current = [];
    setAudioBlob(null);
    if(audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingState('idle');
    setCountdown(15);
  };

  const handleClose = () => {
    onClose();
  };

  const startRecording = async () => {
    if (!supportedMimeType) {
        window.ErrorHandler.report('audio', 'サポートされている録音形式がありません。', { severity: 'error' });
        handleClose();
        return;
    }
    setRecordingState('permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: supportedMimeType });
      
      mediaRecorderRef.current.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) {
            chunksRef.current.push(e.data);
        }
      });

      mediaRecorderRef.current.addEventListener('stop', () => {
        const blob = new Blob(chunksRef.current, { type: supportedMimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setRecordingState('recorded');
        chunksRef.current = [];
        stream.getTracks().forEach(track => track.stop());
      });

      mediaRecorderRef.current.start();
      setRecordingState('recording');
      
      setCountdown(15);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("マイクへのアクセスに失敗:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          window.ErrorHandler.report('audio', 'マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。', { severity: 'error' });
      } else {
          window.ErrorHandler.report('audio', 'マイクの起動に失敗しました。', { severity: 'error' });
      }
      setRecordingState('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const togglePlayback = () => {
    if (recordingState === 'playing') {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };
  
  const handlePost = () => {
      if (audioBlob && audioBlob.size > 0) {
          const extension = supportedMimeType.includes('mp4') ? 'mp4' : (supportedMimeType.includes('ogg') ? 'ogg' : 'webm');
          const fileName = `voice-message-${new Date().toISOString()}.${extension}`;
          const audioFile = new File([audioBlob], fileName, { type: supportedMimeType });
          onPost(audioFile);
          handleClose();
      } else {
          window.ErrorHandler.report('audio', '録音データが空のため投稿できません。', { severity: 'warning' });
      }
  };
  
  const renderControls = () => {
    switch (recordingState) {
      case 'recording':
        return React.createElement('div', { className: 'flex flex-col items-center' },
            React.createElement('div', { className: 'text-4xl font-bold text-red-500 mb-4 animate-pulse' }, countdown),
            React.createElement('button', { onClick: stopRecording, className: 'w-20 h-20 bg-red-500 rounded-full flex items-center justify-center' },
                React.createElement(Pause, { className: 'w-10 h-10 text-white' })
            )
        );
      case 'recorded':
      case 'playing':
        return React.createElement('div', { className: 'flex items-center justify-center gap-4' },
          React.createElement('button', { onClick: handleClose, className: 'p-4 bg-gray-600 rounded-full' },
              React.createElement(Trash2, { className: 'w-8 h-8' })
          ),
          React.createElement('button', { onClick: togglePlayback, className: 'w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center' },
              recordingState === 'playing' 
                  ? React.createElement(Pause, { className: 'w-10 h-10' })
                  : React.createElement(Play, { className: 'w-10 h-10' })
          ),
          React.createElement('button', { onClick: handlePost, className: 'p-4 bg-green-500 rounded-full' },
              React.createElement(Send, { className: 'w-8 h-8' })
          )
        );
      default: // idle, permission
        return React.createElement('div', { className: 'flex flex-col items-center' },
            React.createElement('div', { className: 'text-4xl font-bold mb-4' }, '15'),
            React.createElement('button', {
              onClick: startRecording,
              disabled: recordingState === 'permission' || !supportedMimeType,
              className: 'w-20 h-20 bg-red-500 rounded-full flex items-center justify-center disabled:bg-gray-500'
            }, React.createElement(Mic, { className: 'w-10 h-10 text-white' }))
        );
    }
  };

  return React.createElement('div', { className: 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4' },
    React.createElement('div', { className: 'glass-pane rounded-2xl w-full max-w-sm' },
      React.createElement('div', { className: 'p-6 flex flex-col items-center gap-6' },
        React.createElement('h3', { className: 'text-xl font-bold' }, '音声メッセージ'),
        renderControls(),
        React.createElement('button', { onClick: handleClose, className: 'absolute top-2 right-2 p-2 text-gray-400 hover:text-white' }, '✕')
      )
    ),
    audioUrl && React.createElement('audio', {
        ref: audioRef,
        src: audioUrl,
        onPlay: () => setRecordingState('playing'),
        onPause: () => setRecordingState('recorded'),
        onEnded: () => setRecordingState('recorded'),
    })
  );
};