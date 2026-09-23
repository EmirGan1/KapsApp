import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * RemoteVideo.jsx
 * Kusursuz Uzak Video Bileşeni (Black Screen / Autoplay Bug Fix)
 * 
 * - ref ile doğrudan srcObject ataması yapar (JSX srcObject prop hatasını çözer)
 * - playsInline ve autoPlay içerir
 * - onloadedmetadata ile videoyu kesin oynatır
 * - videoTrack 'unmute' ve 'mute' olaylarını dinleyerek ilk kare geldiğinde videoyu anında gösterir
 */
export const RemoteVideo = ({
  stream,
  isSelf = false,
  muted = true,
  className = '',
  onVideoPlaying
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoTrack = stream ? stream.getVideoTracks()[0] : null;

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play()
      .then(() => {
        setIsPlaying(true);
        if (onVideoPlaying) onVideoPlaying(true);
      })
      .catch((err) => {
        console.debug('[RemoteVideo] Autoplay blocked, enforcing muted playback:', err);
        video.muted = true;
        video.play()
          .then(() => {
            setIsPlaying(true);
            if (onVideoPlaying) onVideoPlaying(true);
          })
          .catch((e) => console.warn('[RemoteVideo] Play failure:', e));
      });
  }, [onVideoPlaying]);

  const attachStream = useCallback((videoElement) => {
    if (!videoElement) return;

    if (stream && videoTrack && videoTrack.readyState === 'live') {
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
      playVideo();
    } else {
      videoElement.srcObject = null;
      setIsPlaying(false);
      if (onVideoPlaying) onVideoPlaying(false);
    }
  }, [stream, videoTrack, playVideo, onVideoPlaying]);

  const setRefCallback = useCallback((node) => {
    videoRef.current = node;
    attachStream(node);
  }, [attachStream]);

  useEffect(() => {
    attachStream(videoRef.current);
  }, [attachStream]);

  useEffect(() => {
    if (!videoTrack) return;

    const handleUnmute = () => {
      console.log('[RemoteVideo] Track unmuted:', videoTrack.id);
      attachStream(videoRef.current);
    };

    const handleMute = () => {
      console.log('[RemoteVideo] Track muted:', videoTrack.id);
      setIsPlaying(false);
      if (onVideoPlaying) onVideoPlaying(false);
    };

    videoTrack.addEventListener('unmute', handleUnmute);
    videoTrack.addEventListener('mute', handleMute);

    return () => {
      videoTrack.removeEventListener('unmute', handleUnmute);
      videoTrack.removeEventListener('mute', handleMute);
    };
  }, [videoTrack, attachStream, onVideoPlaying]);

  return (
    <video
      ref={setRefCallback}
      autoPlay
      playsInline
      muted={muted}
      onLoadedMetadata={() => playVideo()}
      onPlay={() => {
        setIsPlaying(true);
        if (onVideoPlaying) onVideoPlaying(true);
      }}
      className={`w-full h-full object-cover transition-opacity duration-300 ${
        isPlaying ? 'opacity-100' : 'opacity-0'
      } ${isSelf ? 'scale-x-[-1]' : ''} ${className}`}
    />
  );
};

export default RemoteVideo;
